import crypto from 'crypto';

export function hashMessage(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex').slice(0, 16);
}

export class DedupeCache {
  private readonly ttlMs: number;
  private readonly maxEntries: number;
  private readonly entries = new Map<string, number>();

  constructor(ttlMs: number, maxEntries: number) {
    this.ttlMs = ttlMs;
    this.maxEntries = maxEntries;
  }

  has(key: string, now = Date.now()): boolean {
    const ts = this.entries.get(key);
    if (!ts) {
      return false;
    }
    if (now - ts > this.ttlMs) {
      this.entries.delete(key);
      return false;
    }
    this.entries.delete(key);
    this.entries.set(key, ts);
    return true;
  }

  add(key: string, now = Date.now()): void {
    if (this.entries.has(key)) {
      this.entries.delete(key);
    }
    this.entries.set(key, now);
    this.trim(now);
  }

  private trim(now: number): void {
    for (const [key, ts] of this.entries) {
      if (now - ts > this.ttlMs || this.entries.size > this.maxEntries) {
        this.entries.delete(key);
      } else {
        break;
      }
    }
    while (this.entries.size > this.maxEntries) {
      const oldest = this.entries.keys().next().value as string | undefined;
      if (!oldest) {
        break;
      }
      this.entries.delete(oldest);
    }
  }
}
