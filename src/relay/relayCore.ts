import { DedupeCache, hashMessage } from './dedupe';
import { TokenBucket } from './rateLimit';
import { sanitizeDiscordInbound, sanitizeDiscordOutbound, sanitizeMinecraftInbound } from './sanitize';
import { splitMessage } from './split';

export const RELAY_MARKER = '[relay]';

export type RelayDecision = {
  send: boolean;
  content: string | string[];
  reason?: string;
};

export class RelayCore {
  private readonly mcToDiscordLimiter: TokenBucket;
  private readonly discordToMcLimiter: TokenBucket;
  private readonly mcToDiscordDedupe: DedupeCache;
  private readonly discordToMcDedupe: DedupeCache;
  private readonly mentionPolicy: 'none' | 'users' | 'all';
  private readonly maxDiscordLen: number;
  private readonly maxMcLen: number;

  constructor(options: {
    mentionPolicy: 'none' | 'users' | 'all';
    maxDiscordLen: number;
    maxMcLen: number;
    rateLimitPerSec: number;
    rateLimitBurst: number;
    dedupeTtlSec: number;
    dedupeMaxEntries: number;
  }) {
    this.mentionPolicy = options.mentionPolicy;
    this.maxDiscordLen = options.maxDiscordLen;
    this.maxMcLen = options.maxMcLen;
    this.mcToDiscordLimiter = new TokenBucket(options.rateLimitPerSec, options.rateLimitBurst);
    this.discordToMcLimiter = new TokenBucket(options.rateLimitPerSec, options.rateLimitBurst);
    const ttlMs = options.dedupeTtlSec * 1000;
    this.mcToDiscordDedupe = new DedupeCache(ttlMs, options.dedupeMaxEntries);
    this.discordToMcDedupe = new DedupeCache(ttlMs, options.dedupeMaxEntries);
  }

  handleMinecraftChat(username: string, message: string): RelayDecision {
    if (message.includes(RELAY_MARKER)) {
      return { send: false, content: '', reason: 'marker' };
    }
    const sanitized = sanitizeMinecraftInbound(`${username}: ${message}`);
    if (!sanitized) {
      return { send: false, content: '', reason: 'empty' };
    }
    const outbound = sanitizeDiscordOutbound(sanitized, this.mentionPolicy).slice(0, this.maxDiscordLen);
    const hash = hashMessage(outbound);
    if (this.mcToDiscordDedupe.has(hash)) {
      return { send: false, content: '', reason: 'dedupe' };
    }
    if (!this.mcToDiscordLimiter.tryTake()) {
      return { send: false, content: '', reason: 'rate_limit' };
    }
    this.mcToDiscordDedupe.add(hash);
    return { send: true, content: outbound };
  }

  handleDiscordMessage(username: string, message: string): RelayDecision {
    const sanitized = sanitizeDiscordInbound(message, this.mentionPolicy);
    if (!sanitized) {
      return { send: false, content: '', reason: 'empty' };
    }
    const outbound = `${username}: ${sanitized} ${RELAY_MARKER}`.trim();
    const hash = hashMessage(outbound);
    if (this.discordToMcDedupe.has(hash)) {
      return { send: false, content: [], reason: 'dedupe' };
    }
    if (!this.discordToMcLimiter.tryTake()) {
      return { send: false, content: [], reason: 'rate_limit' };
    }
    const chunks = splitMessage(outbound, this.maxMcLen);
    this.discordToMcDedupe.add(hash);
    return { send: true, content: chunks };
  }
}
