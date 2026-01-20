import { EventEmitter } from "events";

interface PlayerState {
  xuid: string;
  username: string;
  lastSeen: number;
}

export class Presence extends EventEmitter {
  private players = new Map<string, PlayerState>();

  constructor(private readonly expirationMs: number) {
    super();
  }

  public addPlayer(xuid: string, username: string) {
    const existing = this.players.get(xuid);
    this.players.set(xuid, {
      xuid,
      username,
      lastSeen: Date.now(),
    });

    if (!existing) {
      this.emit("playerAdded", username, xuid);
    }
  }

  public removePlayer(xuid: string) {
    const existing = this.players.get(xuid);
    if (existing) {
      this.players.delete(xuid);
      this.emit("playerRemoved", existing.username, xuid);
    }
  }

  public touch(xuid: string) {
    const p = this.players.get(xuid);
    if (p) {
      p.lastSeen = Date.now();
    }
  }

  public getRoster(): string[] {
    this.prune();
    return Array.from(this.players.values()).map((p) => p.username);
  }

  public prune() {
    const now = Date.now();
    for (const [xuid, p] of this.players.entries()) {
      if (now - p.lastSeen > this.expirationMs) {
        this.players.delete(xuid);
        this.emit("playerRemoved", p.username, xuid);
      }
    }
  }
}
