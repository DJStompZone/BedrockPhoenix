import { Dedupe } from "../src/relay/dedupe";

describe("Dedupe", () => {
  it("should block duplicate hashes within TTL", () => {
    const dedupe = new Dedupe(1000, 10);
    expect(dedupe.shouldRelay("msg1")).toBe(true);
    expect(dedupe.shouldRelay("msg1")).toBe(false);
  });

  it("should dedupe different messages independently", () => {
    const dedupe = new Dedupe(1000, 10);
    expect(dedupe.shouldRelay("msg1")).toBe(true);
    expect(dedupe.shouldRelay("msg2")).toBe(true);
  });

  it("should allow message again after TTL", async () => {
    const dedupe = new Dedupe(50, 10);
    expect(dedupe.shouldRelay("msg1")).toBe(true);
    await new Promise((r) => setTimeout(r, 100));
    expect(dedupe.shouldRelay("msg1")).toBe(true);
  });

  it("should enforce LRU eviction", () => {
    const dedupe = new Dedupe(1000, 2);
    dedupe.shouldRelay("A");
    dedupe.shouldRelay("B");
    // Cache: [A, B]
    dedupe.shouldRelay("C");
    // Cache: [B, C] (A evicted)

    expect(dedupe.shouldRelay("A")).toBe(true); // Treated as new
    expect(dedupe.shouldRelay("C")).toBe(false); // Still in cache (A evicted B, but C remains)
  });
});
