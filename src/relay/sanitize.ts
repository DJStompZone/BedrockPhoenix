import { stripMinecraftFormatting } from '../mc/stripCodes';

const EVERYONE_REGEX = /@everyone|@here/g;
const USER_MENTION_REGEX = /<@!?\d+>/g;
const ROLE_MENTION_REGEX = /<@&\d+>/g;

export function collapseWhitespace(input: string): string {
  return input.replace(/[\r\n]+/g, ' ').replace(/\s{2,}/g, ' ').trim();
}

export function sanitizeMinecraftInbound(message: string): string {
  return collapseWhitespace(stripMinecraftFormatting(message));
}

export function sanitizeDiscordOutbound(message: string, policy: 'none' | 'users' | 'all'): string {
  let sanitized = collapseWhitespace(message);
  sanitized = sanitized.replace(EVERYONE_REGEX, (match) => `@\u200b${match.slice(1)}`);
  if (policy !== 'all') {
    sanitized = sanitized.replace(ROLE_MENTION_REGEX, '@\u200brole');
  }
  if (policy === 'none') {
    sanitized = sanitized.replace(USER_MENTION_REGEX, '@\u200buser');
  }
  return sanitized;
}

export function sanitizeDiscordInbound(message: string, policy: 'none' | 'users' | 'all'): string {
  let sanitized = collapseWhitespace(message);
  sanitized = sanitized.replace(EVERYONE_REGEX, (match) => `@\u200b${match.slice(1)}`);
  sanitized = sanitized.replace(ROLE_MENTION_REGEX, '@\u200brole');
  if (policy === 'none') {
    sanitized = sanitized.replace(USER_MENTION_REGEX, '@\u200buser');
  }
  return sanitized;
}
