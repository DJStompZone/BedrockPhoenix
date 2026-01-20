import { TokenBucket } from "../src/relay/rateLimit";

describe("TokenBucket", () => {
  it("should consume tokens within capacity", () => {
    const bucket = new TokenBucket(10, 1);
    expect(bucket.consume(5)).toBe(true);
    expect(bucket.consume(5)).toBe(true);
    expect(bucket.consume(1)).toBe(false);
  });

  it("should refill tokens over time", async () => {
    // 10 tokens, 10 per sec
    const bucket = new TokenBucket(10, 10);
    bucket.consume(10);
    expect(bucket.consume(1)).toBe(false);

    // Wait ~0.1s to get 1 token
    await new Promise((r) => setTimeout(r, 150));
    expect(bucket.consume(1)).toBe(true);
  });
});
