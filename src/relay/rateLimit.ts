export class TokenBucket {
  private readonly perSec: number;
  private readonly burst: number;
  private tokens: number;
  private lastRefill: number;

  constructor(perSec: number, burst: number) {
    this.perSec = perSec;
    this.burst = burst;
    this.tokens = burst;
    this.lastRefill = Date.now();
  }

  tryTake(count = 1, now = Date.now()): boolean {
    this.refill(now);
    if (this.tokens >= count) {
      this.tokens -= count;
      return true;
    }
    return false;
  }

  private refill(now: number): void {
    const elapsed = (now - this.lastRefill) / 1000;
    if (elapsed <= 0) {
      return;
    }
    const add = elapsed * this.perSec;
    this.tokens = Math.min(this.burst, this.tokens + add);
    this.lastRefill = now;
  }
}
