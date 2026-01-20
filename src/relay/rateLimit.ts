export class TokenBucket {
  private tokens: number;
  private lastRefill: number;

  constructor(
    private readonly capacity: number,
    private readonly fillPerSecond: number
  ) {
    this.tokens = capacity;
    this.lastRefill = Date.now();
  }

  public consume(amount: number = 1): boolean {
    this.refill();
    if (this.tokens >= amount) {
      this.tokens -= amount;
      return true;
    }
    return false;
  }

  private refill(): void {
    const now = Date.now();
    const elapsedSec = (now - this.lastRefill) / 1000;
    if (elapsedSec > 0) {
      const added = elapsedSec * this.fillPerSecond;
      this.tokens = Math.min(this.capacity, this.tokens + added);
      this.lastRefill = now;
    }
  }
}
