import { EventEmitter } from 'events';

export type PresenceSource = 'packet' | 'chat' | 'list';
export type PresenceEntry = { lastSeen: number; source: PresenceSource };

export class PresenceTracker extends EventEmitter {
  private readonly roster = new Map<string, PresenceEntry>();
  private readonly staleMs: number;

  constructor(staleMinutes = 10) {
    super();
    this.staleMs = staleMinutes * 60 * 1000;
  }

  handlePlayerAdded(names: string[], now = Date.now()): void {
    for (const name of names) {
      this.markSeen(name, 'packet', now);
    }
  }

  handlePlayerRemoved(names: string[], now = Date.now()): void {
    for (const name of names) {
      if (this.roster.delete(name)) {
        this.emit('leave', name, now);
      }
    }
  }

  handleChatSystem(message: string, now = Date.now()): void {
    const joinMatch = /^(.*) joined the game/.exec(message);
    if (joinMatch) {
      this.markSeen(joinMatch[1], 'chat', now);
      return;
    }
    const leaveMatch = /^(.*) left the game/.exec(message);
    if (leaveMatch) {
      if (this.roster.delete(leaveMatch[1])) {
        this.emit('leave', leaveMatch[1], now);
      }
    }
  }

  reconcileFromList(names: string[], now = Date.now()): void {
    const set = new Set(names);
    for (const name of names) {
      this.markSeen(name, 'list', now);
    }
    for (const name of Array.from(this.roster.keys())) {
      if (!set.has(name)) {
        this.roster.delete(name);
        this.emit('leave', name, now);
      }
    }
  }

  sweep(now = Date.now()): void {
    for (const [name, entry] of this.roster.entries()) {
      if (now - entry.lastSeen > this.staleMs) {
        this.roster.delete(name);
        this.emit('leave', name, now);
      }
    }
  }

  getRoster(): string[] {
    return Array.from(this.roster.keys()).sort((a, b) => a.localeCompare(b));
  }

  private markSeen(name: string, source: PresenceSource, now: number): void {
    const existing = this.roster.get(name);
    if (!existing) {
      this.roster.set(name, { lastSeen: now, source });
      this.emit('join', name, now);
    } else {
      this.roster.set(name, { lastSeen: now, source });
    }
  }
}

export function parseListOutput(message: string): string[] {
  const match = /players online:?\s*(.*)/i.exec(message);
  if (!match || !match[1]) {
    return [];
  }
  return match[1]
    .split(',')
    .map((name) => name.trim())
    .filter((name) => name.length > 0);
}
