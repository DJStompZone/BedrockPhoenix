import { sanitizeDiscordInbound, sanitizeDiscordOutbound, sanitizeMinecraftInbound } from '../src/relay/sanitize';

describe('sanitize', () => {
  test('strips minecraft formatting and collapses whitespace', () => {
    expect(sanitizeMinecraftInbound('§aHello\nWorld')).toBe('Hello World');
  });

  test('neutralizes everyone/here mentions', () => {
    expect(sanitizeDiscordOutbound('hello @everyone', 'all')).toBe('hello @\u200beveryone');
  });

  test('neutralizes user mentions when policy none', () => {
    expect(sanitizeDiscordInbound('hi <@123>', 'none')).toBe('hi @\u200buser');
  });

  test('preserves user mentions when policy users', () => {
    expect(sanitizeDiscordOutbound('hi <@123>', 'users')).toBe('hi <@123>');
  });
});
