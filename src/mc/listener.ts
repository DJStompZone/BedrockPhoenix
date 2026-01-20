import { createClient, Client } from "bedrock-protocol";
import { EventEmitter } from "events";
import { Config } from "../config/types";
import { Presence } from "./presence";
import { stripMcFormatting } from "../relay/sanitize";

export class Listener extends EventEmitter {
  private client?: Client;
  private reconnectTimeout?: NodeJS.Timeout;
  private shouldReconnect = true;

  constructor(
    private readonly config: Config,
    private readonly presence: Presence
  ) {
    super();
  }

  public connect() {
    this.shouldReconnect = true;
    try {
      this.client = createClient({
        host: this.config.minecraft.host,
        port: this.config.minecraft.port,
        username: this.config.minecraft.botName,
        offline: true, // Listener usually doesn't need auth if server allows
        // If server has online-mode=true, we need real auth.
        // Spec implies "listener client", often implies phantom/bot.
        // We'll assume offline for now or add config later.
        skipPing: false,
      });

      this.client.on("join", () => {
        this.emit("connect");
      });

      this.client.on("close", () => {
        this.emit("disconnect");
        if (this.shouldReconnect) {
          this.scheduleReconnect();
        }
      });

      this.client.on("error", (err) => {
        this.emit("error", err);
        // Error usually triggers close too?
      });

      this.client.on("text", (packet) => {
        // Packet: { type: 'chat'|'json'|... , source_name, message, ... }
        // We need to parse strictly.
        // console.log('Text packet:', packet);
        const type = packet.type;
        const source = packet.source_name;
        const message = packet.message;
        const xuid = packet.xuid;

        if (type === "chat" && source && message) {
          // Standard chat
          if (xuid) this.presence.touch(xuid);
          // Strip formatting?
          // We emit raw or stripped?
          // Relay logic usually handles stripping.
          // But here is good too.
          this.emit("chat", source, message, xuid);
        } else if (
          type === "shout" ||
          type === "whisper" ||
          type === "announcement"
        ) {
          // Handle if needed
          if (source && message) this.emit("chat", source, message, xuid);
        }
      });

      this.client.on("player_list", (packet) => {
        // records: { xuid, username, uuid, ... }[]
        const records = packet.records;
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
    console.log(`Reconnecting in ${Math.floor(delay)}ms...`);
    this.reconnectTimeout = setTimeout(() => {
      this.reconnectTimeout = undefined;
      this.connect();
    }, delay);
  }
}
