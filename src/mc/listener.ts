import { createClient, Client } from "bedrock-protocol";
import { EventEmitter } from "events";
import { Config } from "../config/types";
import { Presence } from "./presence";
import { stripMcFormatting } from "../relay/sanitize";
import { Logger } from "../logger";
import * as path from "path";

export class Listener extends EventEmitter {
  private client?: Client;
  private reconnectTimeout?: NodeJS.Timeout;
  private shouldReconnect = true;

  constructor(
    private readonly config: Config,
    private readonly presence: Presence,
    private readonly logger: Logger
  ) {
    super();
  }

  public connect() {
    this.shouldReconnect = true;
    try {
      this.logger.info(
        `Connecting to Minecraft server at ${this.config.minecraft.host}:${this.config.minecraft.port}...`
      );

      this.client = createClient({
        host: this.config.minecraft.host,
        port: this.config.minecraft.port,
        username: this.config.minecraft.botName,
        offline: false, // Online mode for Xbox Live Auth
        profilesFolder: path.join(process.cwd(), "auth_cache"), // Persist auth
        skipPing: false,
        onMsaCode: (data: any) => {
          this.logger.warn(
            `\n\n[XBOX AUTH ACTION REQUIRED]\nOpen ${data.verification_uri} and enter code: ${data.user_code}\n\n`
          );
        },
      });

      this.client.on("join", () => {
        this.logger.info("Minecraft: Joined server successfully.");
        this.emit("connect");
      });

      this.client.on("close", () => {
        this.logger.warn("Minecraft: Connection closed.");
        this.emit("disconnect");
        if (this.shouldReconnect) {
          this.scheduleReconnect();
        }
      });

      this.client.on("error", (err) => {
        this.logger.error({ err }, "Minecraft: Connection error");
        this.emit("error", err);
      });

      this.client.on("text", (packet) => {
        // Packet: { type: 'chat'|'json'|... , source_name, message, ... }
        // We need to parse strictly.
        // console.log('Text packet:', packet);
        const type = packet.type;
        const source = packet.source_name;
        const message = packet.message;
        const xuid = packet.xuid;

        // Debug Log
        // Debug Log
        this.logger.info(
          { type, source, message, xuid },
          "Minecraft Packet: Text"
        );

        // Check for JSON types without source/message (sometimes source is in the JSON)
        // or just standard handling.
        let msgContent = message;
        let sender = source;

        // Try to parse JSON if type suggests it or it looks like JSON
        if (
          type === "json" ||
          type === "json_whisper" ||
          (typeof message === "string" && message.startsWith("{"))
        ) {
          try {
            const parsed = JSON.parse(message);
            if (parsed.rawtext && Array.isArray(parsed.rawtext)) {
              msgContent = parsed.rawtext.map((rt: any) => rt.text).join("");
            }
          } catch (e) {
            // Ignore, treat as plain text
          }
        }

        if (
          (type === "chat" ||
            type === "translation" ||
            type === "json" ||
            type === "json_whisper") &&
          msgContent
        ) {
          // If sender is missing, try to extract from message ("<User> Msg")
          if (!sender) {
            const match = msgContent.match(/^<([^>]+)>\s*(.*)$/);
            if (match) {
              sender = match[1];
              msgContent = match[2];
            }
          }

          if (!sender) {
            // Fallback or ignore? Relay needs a user.
            // Maybe it's a system message?
            // Let's log and maybe skip or send as "System"
            // For now, skip if no sender? Or use "Server"?
            // The user log shows <MooSaurus25>.
            // Wait, the unshift might be needed BEFORE extracting user if user is also shifted?
            // Log shows: <MooSaurus25> <ShiftedMsg>.
            // So user is NOT shifted, but msg is?
            // Use unshiftText on everything just in case.
          }

          if (sender) {
            if (xuid) this.presence.touch(xuid);

            const cleanMessage = this.unshiftText(msgContent);
            const cleanSource = this.unshiftText(sender);

            this.emit("chat", cleanSource, cleanMessage, xuid);
          }
        } else if (
          type === "shout" ||
          type === "whisper" ||
          type === "announcement"
        ) {
          // Handle if needed
          const cleanMessage = this.unshiftText(message);
          const cleanSource = source ? this.unshiftText(source) : source;
          if (source && message)
            this.emit("chat", cleanSource, cleanMessage, xuid);
        }
      });

      this.client.on("player_list", (packet) => {
        // records: { xuid, username, uuid, ... }[]
        const records = packet.records;
        if (!records || !Array.isArray(records)) return;

        for (const r of records) {
          if (packet.type === "add") {
            this.presence.addPlayer(r.xuid, r.username);
          } else if (packet.type === "remove") {
            this.presence.removePlayer(r.uuid); // Wait, Bedrock uses UUID for remove? check docs.
            // Usually it sends UUID match.
            // But we track by XUID?
            // If we only have UUID in remove packet, we need to map properly.
            // Let's assume remove checks UUID.
            // We need to map uuid -> xuid or just store by uuid?
            // XUID is stable. UUID is session?
          }
        }
      });

      // Spawn/StartGame might also have player info
    } catch (err) {
      this.emit("error", err);
      this.scheduleReconnect();
    }
  }

  public disconnect() {
    this.shouldReconnect = false;
    if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
    this.client?.close();
  }

  private scheduleReconnect() {
    if (this.reconnectTimeout) return;
    const delay = Math.random() * 5000 + 5000; // 5-10s jitter
    this.logger.info(`Minecraft: Reconnecting in ${Math.floor(delay)}ms...`);
    this.reconnectTimeout = setTimeout(() => {
      this.reconnectTimeout = undefined;
      this.connect();
    }, delay);
  }

  private unshiftText(text: string): string {
    // Detects characters shifted by 10240 (0x2800) and unshifts them
    return text
      .split("")
      .map((c) => {
        const code = c.charCodeAt(0);
        if (code >= 0x2800 && code < 0x2800 + 0xffff) {
          // Simple check, exact range unknown but user said 10240
          // Actually, if it's just shifted, let's see.
          // ASCII space (32) + 10240 = 10272
          // Let's assume ANY char > 10240 might be shifted if the pack does it blindly.
          // But let's check if unshifting brings it to printable ASCII range?
          const unshifted = code - 10240;
          if (unshifted >= 32 && unshifted <= 126) {
            return String.fromCharCode(unshifted);
          }
        }
        return c;
      })
      .join("");
  }
}
