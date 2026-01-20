import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
} from "discord.js";

export interface CommandHandler {
  data: any;
  execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
  adminOnly?: boolean;
}

export const commands: Record<string, CommandHandler> = {
  status: {
    data: new SlashCommandBuilder()
      .setName("status")
      .setDescription("Show server and relay status"),
    execute: async (interaction) => {
      // Wiring happens in main or client, this is just definitions mostly
      // To handle execution, we need access to the Relay instance or Context.
      // We might need to inject context.
      // For now, we'll placeholder the execution or make this just exports.
    },
  },
  reconnect: {
    data: new SlashCommandBuilder()
      .setName("reconnect")
      .setDescription("Force reconnect to Minecraft server")
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    adminOnly: true,
    execute: async () => {},
  },
  list: {
    data: new SlashCommandBuilder()
      .setName("list")
      .setDescription("List online players"),
    execute: async () => {},
  },
  kick: {
    data: new SlashCommandBuilder()
      .setName("kick")
      .setDescription("Kick a player from the server")
      .addStringOption((opt) =>
        opt.setName("player").setDescription("Name or XUID").setRequired(true)
      )
      .addStringOption((opt) =>
        opt.setName("reason").setDescription("Kick reason").setRequired(false)
      )
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    adminOnly: true,
    execute: async () => {},
  },
  restart: {
    data: new SlashCommandBuilder()
      .setName("restart")
      .setDescription("Restart the bedrock server process (via pm2)")
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    adminOnly: true,
    execute: async () => {},
  },
};
