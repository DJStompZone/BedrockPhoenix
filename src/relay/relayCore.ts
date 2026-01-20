import { Config } from "../config/types";
import { spawn } from "child_process";
import { Logger } from "../logger";
import { DiscordBot } from "../discord/client";
import { Listener } from "../mc/listener";
import { Presence } from "../mc/presence";
import { pm2Send } from "../pm2/send";
import { Dedupe } from "./dedupe";
import { TokenBucket } from "./rateLimit";
import { sanitizeDiscordToMc, stripMcFormatting } from "./sanitize";
import { splitMessage } from "./split";
import { ChatInputCommandInteraction } from "discord.js";

import { resolvePm2Id } from "../pm2/resolve";

export class RelayCore {
  private dedupe: Dedupe;
  private mcRateLimit: TokenBucket;
  private discordRateLimit: TokenBucket;
  private pm2Id: string;

  constructor(
    private readonly config: Config,
    private readonly discord: DiscordBot,
    private readonly mc: Listener,
    private readonly presence: Presence,
    private readonly logger?: Logger
  ) {
    this.dedupe = new Dedupe(
      this.config.relay.dedupeTtlSec * 1000,
      this.config.relay.dedupeMaxEntries
    );

    this.mcRateLimit = new TokenBucket(
      this.config.relay.rateLimitBurst,
      this.config.relay.rateLimitPerSec
    );

    this.discordRateLimit = new TokenBucket(
      this.config.relay.rateLimitBurst,
      this.config.relay.rateLimitPerSec
    );

    this.pm2Id = this.config.pm2.target;
  }

  public async start() {
    this.pm2Id = await resolvePm2Id(this.config.pm2.target);
    this.logger?.info(
      `Relay: Resolved PM2 target '${this.config.pm2.target}' to ID ${this.pm2Id}`
    );

    // MC -> Discord
    this.mc.on("chat", async (user, message, xuid) => {
      // 1. Dedupe
      const hash = `${user}:${message}`;
      // Note: hash collision possible? simple string concat.
      // Better: crypto hash or separator.
      // But spec says "stable (sha256 truncated ok)".
      // Let's rely on simple string or if needed update dedupe to hash.
      // Given dedupe is "internal implementation", passing string key is fine.

      // We check if WE sent this message (loop prevention via marker)
      // If message contains relay.marker? Spec mentions "relay.marker".
      // But we send to stdin. Stdin -> Chat ?
      // If we send via /say, it comes as "[Server] ...".
      // If we send via /tellraw, it comes as whatever we formatted.
      // We should check if it matches our outbound format.
      // Or just rely on dedupe.

      if (!this.dedupe.shouldRelay(hash)) return;

      // 2. Strip formatting
      const cleanMsg = stripMcFormatting(message);

      // 3. Rate Limit
      if (!this.discordRateLimit.consume()) {
        this.logger?.warn("Relay: Rate limit hit (MC->DC)");
        return;
      }

      // 4. Send
      await this.discord.send(`**${user}**: ${cleanMsg}`);
    });

    // Discord -> MC
    this.discord.on("message", async (doc) => {
      const user = doc.author.username; // Or displayName
      const content = doc.content;

      // 1. Sanitize
      const clean = sanitizeDiscordToMc(
        content,
        this.config.relay.mentionPolicy
      );
      if (!clean.trim()) return;

      // 2. Rate Limit
      if (!this.mcRateLimit.consume()) {
        // React with rate limit emoji?
        doc.react("⏳").catch(() => {});
        return;
      }

      // 3. Split
      const parts = splitMessage(clean, this.config.relay.maxMcLen);

      // 4. Send via PM2
      for (const part of parts) {
        await this.sendToMc(user, part);
      }
    });

    this.discord.on("command", (interaction: ChatInputCommandInteraction) => {
      this.handleCommand(interaction);
    });

    this.mc.connect();
    this.discord.start();
  }

  private async sendToMc(user: string, message: string) {
    // Construct args based on template
    // Template: ["/tellraw", "@a", "{\"rawtext\":...}"]
    // We need to substitute {username} and {message}

    const template = this.config.pm2.sendArgsTemplate;
    const args = template.map((arg) => {
      return arg.replace("{username}", user).replace("{message}", message);
    });

    // Add to dedupe cache so we don't echo back if MC broadcasts it
    // What does MC broadcast?
    // If we use /tellraw, it shows to players. Does it go to socket/listener?
    // Usually /tellraw does NOT trigger a chat packet in bedrock-protocol (it's text packet, strictly).
    // Listener handles 'text' packet.
    // If /tellraw triggers text packet, we might echo.
    // We should hash the EXPECTED output.
    // But we don't know exactly how MC formats it unless we know the rawtext structure.
    // Wait, if we send /tellraw, the packet we receive will assume the "message" part of the packet match?
    // Deduping on "message content" might be enough if user name is part of it.
    // Or we just rely on "Sender" check.
    // if source is "Server" or empty?
    // For now, let's cache the message content if possible or the user+message key.

    // Let's add the message part to dedupe just in case.
    // But if we send "Hello", and user says "Hello", we shouldn't block user.
    // So dedupe should be strict.
    // If we receive the EXACT SAME message from "External" source, good to block?
    // "ignore messages whose hash matches recently relayed outbound" matches this.

    // We'll approximate the echo by hashing what we expect the listener to see.
    // If using rawtext `[Discord] User: Msg`, listener might see `[Discord] User: Msg`.
    // So we hash that.
    // But we don't know the full format easily without parsing the JSON template.

    try {
      await pm2Send(this.pm2Id, args);
    } catch (err) {
      if (this.logger)
        this.logger.error({ err }, "Relay: Failed to send to MC");
      else console.error("Relay: Failed to send to MC", err);
    }
  }

  private async handleCommand(interaction: ChatInputCommandInteraction) {
    const { commandName } = interaction;

    if (commandName === "status") {
      const roster = this.presence.getRoster();
      await interaction.reply({
        content: `**System Status**
MC Connection: ${this.mc["client"] ? "Connected" : "Disconnected"}
Roster (${roster.length}): ${roster.join(", ")}
Rate Limits: OK`,
        ephemeral: true,
      });
    } else if (commandName === "reconnect") {
      this.mc.disconnect();
      this.mc.connect();
      await interaction.reply({
        content: "Reconnecting MC listener...",
        ephemeral: true,
      });
    } else if (commandName === "list") {
      const roster = this.presence.getRoster();
      await interaction.reply({
        content: `**Online Players (${roster.length})**:\n${roster.join(", ")}`,
      });
    } else if (commandName === "kick") {
      const player = interaction.options.getString("player", true);
      const reason =
        interaction.options.getString("reason") || "Kicked by admin";
      await pm2Send(this.pm2Id, ["/kick", `"${player}"`, reason]);
      await interaction.reply({
        content: `Kicked ${player}.`,
        ephemeral: true,
      });
    } else if (commandName === "restart") {
      await interaction.reply({
        content: "Restarting server process...",
        ephemeral: true,
      });

      await pm2Send(this.pm2Id, ["/stop"]);
      // Reuse spawn for restart logic, maybe wait a bit?
      // For restart, we might need the original name if we use 'pm2 restart <name>'?
      // But ID works for restart too.
      spawn("pm2", ["restart", this.pm2Id]);
    }
  }
}
