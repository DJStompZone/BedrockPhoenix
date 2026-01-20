import { EventEmitter } from 'events';
import { createClient, Client } from 'bedrock-protocol';
import { PresenceTracker } from './presence';
import { stripMinecraftFormatting } from './stripCodes';

export type ListenerOptions = {
  host: string;
  port: number;
  botName: string;
};

export class BedrockListener extends EventEmitter {
  private client: Client | null = null;
  private stopped = false;
  private reconnectAttempt = 0;
  private readonly presence: PresenceTracker;
  private readonly options: ListenerOptions;

  constructor(options: ListenerOptions, presence: PresenceTracker) {
    super();
    this.options = options;
    this.presence = presence;
  }

  start(): void {
    this.stopped = false;
    this.connect();
  }

  stop(): void {
    this.stopped = true;
    this.client?.disconnect();
  }

  private connect(): void {
    if (this.stopped) {
      return;
    }
    this.client = createClient({
      host: this.options.host,
      port: this.options.port,
      username: this.options.botName,
      offline: true,
    });

    this.client.on('text', (packet: { message?: string; source_name?: string; type?: string }) => {
      const message = packet.message ?? '';
      const source = packet.source_name ?? '';
      const type = packet.type ?? '';
      this.emit('chat', { source, message, type });
      if (type === 'chat' && source && message) {
        this.emit('playerChat', { source, message: stripMinecraftFormatting(message) });
      }
      if (type === 'system') {
        this.presence.handleChatSystem(stripMinecraftFormatting(message));
      }
    });

    this.client.on('player_list', (packet: { records?: { username: string; uuid: string; type: string }[] }) => {
      const added: string[] = [];
      const removed: string[] = [];
      for (const record of packet.records ?? []) {
        if (record.type === 'add') {
          added.push(record.username);
        }
        if (record.type === 'remove') {
          removed.push(record.username);
        }
      }
      if (added.length) {
        this.presence.handlePlayerAdded(added);
      }
      if (removed.length) {
        this.presence.handlePlayerRemoved(removed);
      }
    });

    this.client.on('disconnect', () => {
      this.emit('disconnect');
      this.scheduleReconnect();
    });

    this.client.on('error', (err: Error) => {
      this.emit('error', err);
    });

    this.client.on('spawn', () => {
      this.reconnectAttempt = 0;
      this.emit('ready');
    });
  }

  private scheduleReconnect(): void {
    if (this.stopped) {
      return;
    }
    const attempt = this.reconnectAttempt + 1;
    this.reconnectAttempt = attempt;
    const base = Math.min(30000, 1000 * 2 ** attempt);
    const jitter = Math.floor(Math.random() * 500);
    const delay = base + jitter;
    this.emit('reconnect', { attempt, delay });
    setTimeout(() => this.connect(), delay);
  }
}
