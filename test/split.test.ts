import { splitMessage } from "../src/relay/split";

describe("splitMessage", () => {
  it("should not split short messages", () => {
    expect(splitMessage("Hello World", 20)).toEqual(["Hello World"]);
  });

  it("should split on words", () => {
    const text = "This is a long message that needs splitting";
    // Split len 10
    // "This is a" (9)
    // "long" (4) -> "long message" ? (12 > 10)
    // "long" (4)
    // "message" (7)
    // ...
    const parts = splitMessage(text, 10);
    expect(parts[0]).toBe("This is a");
    expect(parts[1]).toBe("long");
    expect(parts[2]).toBe("message"); // Or similar depending on greedy logic
  });

  it("should split hard if word is too long", () => {
    expect(splitMessage("AAAAABBBBB", 5)).toEqual(["AAAAA", "BBBBB"]);
  });

  it("should respect prefix", () => {
    // Prefix length 5 "PRE: "
    // Max 10 -> 5 chars allowed per part
    const parts = splitMessage("12345 67890", 10, "PRE: ");
    expect(parts).toEqual(["PRE: 12345", "PRE: 67890"]);
  });
});
