import pino from 'pino';
import { loadEncryptedConfig } from './config/load';
import { RelayCore } from './relay/relayCore';
import { BedrockListener } from './mc/listener';
import { PresenceTracker, parseListOutput } from './mc/presence';
import { pm2Send } from './pm2/send';
import { startDiscordClient, isAdmin } from './discord/client';

async function main(): Promise<void> {
  const configPath = process.env.MC_RELAY_CONFIG ?? 'config.enc.json';
  const config = await loadEncryptedConfig(configPath);

  const logger = pino({
    level: config.observability.logLevel,
    transport: config.observability.logHuman
      ? {
          target: 'pino-pretty',
          options: { colorize: true },
        }
      : undefined,
  });

  const presence = new PresenceTracker();
  const relay = new RelayCore({
    mentionPolicy: config.relay.mentionPolicy,
    maxDiscordLen: config.relay.maxDiscordLen,
    maxMcLen: config.relay.maxMcLen,
    rateLimitPerSec: config.relay.rateLimitPerSec,
    rateLimitBurst: config.relay.rateLimitBurst,
    dedupeTtlSec: config.relay.dedupeTtlSec,
    dedupeMaxEntries: config.relay.dedupeMaxEntries,
  });

  const listener = new BedrockListener(
    { host: config.minecraft.host, port: config.minecraft.port, botName: config.minecraft.botName },
    presence,
  );

  listener.on('ready', () => logger.info({ event: 'mc_ready' }, 'Minecraft listener ready'));
  listener.on('disconnect', () => logger.warn({ event: 'mc_disconnect' }, 'Minecraft listener disconnected'));
  listener.on('reconnect', ({ attempt, delay }) =>
    logger.info({ event: 'mc_reconnect', reconnect_attempt: attempt, backoff_ms: delay }, 'Reconnecting to MC'),
  );
  listener.on('error', (err) => logger.error({ event: 'mc_error', err }, 'Minecraft listener error'));

  listener.on('playerChat', ({ source, message }) => {
    const decision = relay.handleMinecraftChat(source, message);
    if (!decision.send || typeof decision.content !== 'string') {
      return;
    }
    discordChannelSend(decision.content).catch((err) =>
      logger.error({ event: 'discord_send_error', err }, 'Failed to send to Discord'),
    );
  });

  listener.on('chat', ({ message, type }) => {
    if (type === 'system') {
      const roster = parseListOutput(message);
      if (roster.length) {
        presence.reconcileFromList(roster);
      }
    }
  });

  presence.on('join', (player) => logger.info({ event: 'mc_join', user: player }, 'Player joined'));
  presence.on('leave', (player) => logger.info({ event: 'mc_leave', user: player }, 'Player left'));

  const discordClient = await startDiscordClient(
    {
      token: config.discord.token,
      guildId: config.discord.guildId,
      channelId: config.discord.channelId,
      adminUserIds: config.discord.adminUserIds ?? [],
    },
    {
      onMessage: async (message) => {
        const decision = relay.handleDiscordMessage(message.author.username, message.content);
        if (!decision.send || !Array.isArray(decision.content)) {
          return;
        }
        for (const chunk of decision.content) {
          const argv = config.pm2.sendArgsTemplate.map((part) =>
            part.replace('{username}', message.author.username).replace('{message}', chunk),
          );
          await pm2Send(config.pm2.target, argv);
        }
      },
      onCommand: async (interaction) => {
        if (!interaction.isChatInputCommand()) {
          return;
        }
        const admin = isAdmin(interaction.user.id, config.discord.adminUserIds ?? []);
        switch (interaction.commandName) {
          case 'status': {
            const roster = presence.getRoster();
            await interaction.reply({
              content: `Relay online. Players: ${roster.length}.`,
              ephemeral: true,
            });
            return;
          }
          case 'reconnect': {
            if (!admin) {
              await interaction.reply({ content: 'Admin only.', ephemeral: true });
              return;
            }
            listener.stop();
            listener.start();
            await interaction.reply({ content: 'Reconnecting to Minecraft...', ephemeral: true });
            return;
          }
          case 'list': {
            const roster = presence.getRoster();
            await interaction.reply({
              content: roster.length ? `Online: ${roster.join(', ')}` : 'No players online.',
              ephemeral: true,
            });
            return;
          }
          case 'kick': {
            if (!admin) {
              await interaction.reply({ content: 'Admin only.', ephemeral: true });
              return;
            }
            const player = interaction.options.getString('player', true);
            await pm2Send(config.pm2.target, ['/kick', player]);
            await interaction.reply({ content: `Kick command sent for ${player}.`, ephemeral: true });
            return;
          }
          case 'restart': {
            if (!admin) {
              await interaction.reply({ content: 'Admin only.', ephemeral: true });
              return;
            }
            await pm2Send(config.pm2.target, ['/stop']);
            await interaction.reply({ content: 'Restart command sent.', ephemeral: true });
            return;
          }
          default:
            return;
        }
      },
    },
  );

  async function discordChannelSend(content: string): Promise<void> {
    const channel = await discordClient.channels.fetch(config.discord.channelId);
    if (!channel || !channel.isTextBased()) {
      throw new Error('Discord channel not found or not text based.');
    }
    await channel.send(content);
  }

  listener.start();

  setInterval(() => presence.sweep(), 60 * 1000).unref();
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
