import { Client, GatewayIntentBits, Partials, Interaction, Message } from 'discord.js';
import { registerCommands } from './commands';

export type DiscordClientOptions = {
  token: string;
  guildId: string;
  channelId: string;
  adminUserIds: string[];
};

export type DiscordEvents = {
  onMessage: (message: Message) => void;
  onCommand: (interaction: Interaction) => void;
};

export async function startDiscordClient(
  options: DiscordClientOptions,
  handlers: DiscordEvents,
): Promise<Client> {
  const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
    partials: [Partials.Channel],
  });

  client.on('ready', async () => {
    if (!client.user) {
      return;
    }
    await registerCommands({ token: options.token, clientId: client.user.id, guildId: options.guildId });
  });

  client.on('messageCreate', (message) => {
    if (message.author.bot) {
      return;
    }
    if (message.channelId !== options.channelId) {
      return;
    }
    handlers.onMessage(message);
  });

  client.on('interactionCreate', (interaction) => {
    handlers.onCommand(interaction);
  });

  await client.login(options.token);
  return client;
}

export function isAdmin(userId: string, adminUserIds: string[]): boolean {
  return adminUserIds.includes(userId);
}
