export class Dedupe {
  private cache = new Map<string, number>();

  constructor(
    private readonly ttlMs: number,
    private readonly maxEntries: number
  ) {}

  public shouldRelay(hash: string): boolean {
    const now = Date.now();
    this.cleanup(now);

    if (this.cache.has(hash)) {
      return false; // Already processed
    }

    // Add new entry
    this.cache.set(hash, now + this.ttlMs);

    // Enforce max entries via LRU (Map insertion order)
    if (this.cache.size > this.maxEntries) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }

    return true;
  }

  private cleanup(now: number): void {
    // Optional: lazy cleanup or proactive.
    // Since we check specific keys, lazy is fine, but to keep size correct we might want to scan.
    // However, for 200 items, full scan is cheap.
    for (const [key, expiry] of this.cache.entries()) {
      if (expiry < now) {
        this.cache.delete(key);
      } else {
        // Map is insertion ordered. If we added in order, oldest are first.
        // But updates might mess this if we re-set?
        // We only set new items.
        // So we can stop if we find one valid?
        // No, because different items have different insertion times.
        // But since they are added sequentially with fixed TTL, they expire sequentially.
        // So yes, we can break.
        break; // Oldest are at the start
      }
    }
  }
}
