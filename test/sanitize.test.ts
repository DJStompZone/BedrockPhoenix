import { stripMcFormatting, sanitizeDiscordToMc } from "../src/relay/sanitize";

describe("Sanitize", () => {
  describe("stripMcFormatting", () => {
    it("should remove color codes", () => {
      expect(stripMcFormatting("§aHello §cWorld")).toBe("Hello World");
    });
    it("should handle obscure codes", () => {
      expect(stripMcFormatting("§kObfuscated")).toBe("Obfuscated");
    });
  });

  describe("sanitizeDiscordToMc", () => {
    it("should neutralize @everyone and @here", () => {
      expect(sanitizeDiscordToMc("Hello @everyone")).toBe("Hello everyone");
      expect(sanitizeDiscordToMc("@here guys")).toBe("here guys");
    });

    it("should collapse newlines", () => {
      expect(sanitizeDiscordToMc("Line1\nLine2")).toBe("Line1 Line2");
      expect(sanitizeDiscordToMc("Line1\r\nLine2")).toBe("Line1 Line2");
    });

    it("should strip markdown chars", () => {
      expect(sanitizeDiscordToMc("**Bold** *Italic*")).toBe("Bold Italic");
    });

    it("should remove role mentions", () => {
      expect(sanitizeDiscordToMc("Hi <@&12345>")).toBe("Hi");
    });
  });
});
