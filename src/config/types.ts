import { z } from 'zod';

export const ConfigSchema = z.object({
  discord: z.object({
    token: z.string().min(1),
    guildId: z.string().min(1),
    channelId: z.string().min(1),
    adminUserIds: z.array(z.string().min(1)).optional(),
  }),
  minecraft: z.object({
    host: z.string().min(1),
    port: z.number().int().positive().default(19132),
    botName: z.string().min(1),
  }),
  pm2: z.object({
    target: z.string().min(1),
    sendArgsTemplate: z.array(z.string().min(1)),
  }),
  relay: z.object({
    mentionPolicy: z.enum(['none', 'users', 'all']),
    maxDiscordLen: z.number().int().positive().default(1800),
    maxMcLen: z.number().int().positive().default(240),
    rateLimitPerSec: z.number().positive(),
    rateLimitBurst: z.number().positive(),
    dedupeTtlSec: z.number().int().positive(),
    dedupeMaxEntries: z.number().int().positive(),
  }),
  observability: z.object({
    logLevel: z.enum(['debug', 'info', 'warn', 'error']),
    logHuman: z.boolean(),
  }),
});

export type RelayConfig = z.infer<typeof ConfigSchema>;
