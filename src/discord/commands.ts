import { REST, Routes, SlashCommandBuilder } from 'discord.js';

export function buildCommands() {
  return [
    new SlashCommandBuilder().setName('status').setDescription('Show relay status'),
    new SlashCommandBuilder().setName('reconnect').setDescription('Reconnect the Bedrock listener'),
    new SlashCommandBuilder().setName('list').setDescription('List online Minecraft players'),
    new SlashCommandBuilder()
      .setName('kick')
      .setDescription('Kick a Minecraft player')
      .addStringOption((option) => option.setName('player').setDescription('Player name').setRequired(true)),
    new SlashCommandBuilder().setName('restart').setDescription('Restart the Bedrock server'),
  ];
}

export async function registerCommands(options: {
  token: string;
  clientId: string;
  guildId: string;
}): Promise<void> {
  const rest = new REST({ version: '10' }).setToken(options.token);
  const body = buildCommands().map((command) => command.toJSON());
  await rest.put(Routes.applicationGuildCommands(options.clientId, options.guildId), { body });
}
