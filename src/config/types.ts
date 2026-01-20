import { z } from "zod";

export const ConfigSchema = z.object({
  discord: z.object({
    token: z.string().min(1),
    guildId: z.string().min(1),
    channelId: z.string().min(1),
    adminUserIds: z.array(z.string()).optional(),
  }),
  minecraft: z.object({
    host: z.string().min(1),
    port: z.number().int().positive().default(19132),
    botName: z.string().min(1),
  }),
  pm2: z.object({
    target: z.string().min(1),
    sendArgsTemplate: z.array(z.string()).min(1),
  }),
  relay: z.object({
    mentionPolicy: z.enum(["none", "users", "all"]).default("none"),
    maxDiscordLen: z.number().int().positive().default(1800),
    maxMcLen: z.number().int().positive().default(200),
    rateLimitPerSec: z.number().positive(),
    rateLimitBurst: z.number().int().positive(),
    dedupeTtlSec: z.number().int().positive().default(30),
    dedupeMaxEntries: z.number().int().positive().default(200),
  }),
  observability: z.object({
    logLevel: z.enum(["debug", "info", "warn", "error"]).default("info"),
    logHuman: z.boolean().default(false),
  }),
});

export type Config = z.infer<typeof ConfigSchema>;

export interface EncryptedConfig {
  version: number;
  kdf: {
    name: "scrypt";
    salt_b64: string;
    N: number;
    r: number;
    p: number;
  };
  cipher: {
    name: "aes-256-gcm";
    nonce_b64: string;
  };
  ciphertext_b64: string;
  tag_b64: string;
}
