import { Client, GatewayIntentBits, Events, REST, Routes } from "discord.js";
import { EventEmitter } from "events";
import { Config } from "../config/types";
import { commands, CommandHandler } from "./commands";

export class DiscordBot extends EventEmitter {
  public client: Client;
  private commands = new Map<string, CommandHandler>();

  constructor(private readonly config: Config) {
    super();
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
      ],
    });

    // Load commands
    for (const [name, handler] of Object.entries(commands)) {
      this.commands.set(name, handler);
    }
  }

  public async start() {
    this.client.on(Events.ClientReady, async () => {
      console.log(`Discord: Logged in as ${this.client.user?.tag}`);
      await this.registerCommands();
      this.emit("ready");
    });

    this.client.on(Events.MessageCreate, (message) => {
      if (message.author.bot) return;
      if (message.guildId !== this.config.discord.guildId) return;
      if (message.channelId !== this.config.discord.channelId) return;

      this.emit("message", message);
    });

    this.client.on(Events.InteractionCreate, async (interaction) => {
      if (!interaction.isChatInputCommand()) return;

      const handler = this.commands.get(interaction.commandName);
      if (handler) {
        // Enforce admin if needed
        if (handler.adminOnly) {
          const userId = interaction.user.id;
          const admins = this.config.discord.adminUserIds || [];
          if (!admins.includes(userId)) {
            // Additional check besides Discord permissions (which can be bypassed by server admins)
            // or just trust Discord permissions?
            // Prompt says "admin-only".
            // Ideally we check config.
            if (!admins.includes(userId)) {
              await interaction.reply({
                content: "You are not authorized to use this command.",
                ephemeral: true,
              });
              return;
            }
          }
        }

        try {
          // We pass the interaction to the main relay or handle it here?
          // The commands need access to Relay internals (reconnect, status).
          // So we emit an event? or allow the handler to be injected?
          // "execute" in commands.ts was empty.
          // We should emit 'command' event?
          this.emit("command", interaction);
        } catch (error) {
          console.error(error);
          if (interaction.replied || interaction.deferred) {
            await interaction.followUp({
              content: "There was an error executing this command!",
              ephemeral: true,
            });
          } else {
            await interaction.reply({
              content: "There was an error executing this command!",
              ephemeral: true,
            });
          }
        }
      }
    });

    await this.client.login(this.config.discord.token);
  }

  private async registerCommands() {
    if (!this.client.user) return;
    const rest = new REST({ version: "10" }).setToken(
      this.config.discord.token
    );
    const body = Array.from(this.commands.values()).map((c) => c.data.toJSON());

    try {
      console.log("Discord: Refreshing slash commands...");
      await rest.put(
        Routes.applicationGuildCommands(
          this.client.user.id,
          this.config.discord.guildId
        ),
        { body }
      );
      console.log("Discord: Slash commands registered.");
    } catch (error) {
      console.error("Discord: Failed to register commands:", error);
    }
  }

  public async send(content: string) {
    if (!this.client.isReady()) return;
    const channel = await this.client.channels.fetch(
      this.config.discord.channelId
    );
    const textChannel = channel as any;
    // Using any to avoid complicated type guards with isTextBased() in some versions
    if (textChannel.send) await textChannel.send(content);
  }

  public async setStatus(msg: string) {
    if (this.client.user) {
      this.client.user.setActivity(msg);
    }
  }
}
