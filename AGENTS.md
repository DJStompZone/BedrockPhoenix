# AGENTS.md — Implementation guide for coding agents

This file is the **authoritative engineering spec** for automated coding agents implementing the project.

## 1) Project summary

Implement a **bidirectional** chat relay between:

- **Minecraft Bedrock Dedicated Server (vanilla)** and
- **Discord** (single guild + channel)

Core decision:
- Use **bedrock-protocol** ONLY for **listening** (MC → Discord).
- Use **pm2 send** to write to **BDS STDIN** for outbound (Discord → MC).

Reason: observed/known issues with outbound chat delivery when sending chat via the Bedrock client protocol path (packet loss / inconsistent delivery).

## 2) Tech stack (de facto)

- Node.js 20+
- TypeScript
- `discord.js` v14
- `bedrock-protocol` (listener client)
- `pm2` is used as process manager for BDS and stdin injection. pm2 setup is managed externally to this project
- Testing: `jest`
- Lint/format: `eslint` + `prettier`

## 3) Repo layout (required)

```
bedrock-phoenix/
  README.md
  AGENTS.md
  prompt.txt
  package.json
  tsconfig.json
  src/
    main.ts
    config/
      config.template.json
      crypto.ts
      load.ts
      types.ts
    relay/
      relayCore.ts
      dedupe.ts
      rateLimit.ts
      sanitize.ts
      split.ts
    discord/
      client.ts
      commands.ts
    mc/
      listener.ts
      presence.ts
      stripCodes.ts
    pm2/
      send.ts
      selftest.ts
  test/
    sanitize.test.ts
    split.test.ts
    dedupe.test.ts
    rateLimit.test.ts
    presence.test.ts
  dist/ (build output)
```

Single-responsibility modules. No monolithic god-files.

## 4) Configuration model (single encrypted JSON)

### Plain config shape
Define a typed config schema (zod recommended):

- discord:
  - token: string
  - guildId: string
  - channelId: string
  - adminUserIds?: string[]
- minecraft:
  - host: string
  - port: number (19132 default)
  - botName: string
- pm2:
  - target: string  // process name or numeric id as string
  - sendArgsTemplate: string[] // argv template, e.g. ["/tellraw", "@a", "[{username}]{message}"]
- relay:
  - mentionPolicy: "none" | "users" | "all"
  - maxDiscordLen: number (1800)
  - maxMcLen: number (240 default, split)
  - rateLimitPerSec: number
  - rateLimitBurst: number
  - dedupeTtlSec: number (30)
  - dedupeMaxEntries: number (200)
- observability:
  - logLevel: "debug"|"info"|"warn"|"error"
  - logHuman: boolean

### Encryption spec
Implement file encryption with Node `crypto`:

- KDF: `scrypt` with parameters chosen for interactive use (document them)
- Cipher: `aes-256-gcm`
- Random salt and nonce per encryption
- Output file format JSON:

```json
{
  "version": 1,
  "kdf": { "name": "scrypt", "salt_b64": "...", "N": 16384, "r": 8, "p": 1 },
  "cipher": { "name": "aes-256-gcm", "nonce_b64": "..." },
  "ciphertext_b64": "...",
  "tag_b64": "..."
}
```

- Password entry:
  - Prompt via stdin TTY when not provided
  - Support `MC_RELAY_PASSWORD` env var for non-interactive deployments

### CLI
Provide a CLI in `src/cli.ts` (compiled to `dist/cli.js`) with commands:

- `encrypt-config --in <plain.json> --out <enc.json>`
- `decrypt-config --in <enc.json> --out <plain.json>` (optional, but useful)
- `validate-config --config <enc.json>`
- `selftest-pm2 --target <name|id>` (runs send-to-stdin probe)

## 5) pm2 send strategy

### Requirement
On Discord → MC message, write a line to BDS stdin by calling:

- `pm2 send <target> <argv...>`

Implementation details:
- Use `child_process.spawn("pm2", ["send", target, ...argv], { stdio: "ignore" })`
- Escape/quote carefully:
  - Do NOT shell-escape via `exec`
  - Never pass through untrusted shell strings

### Self-test
At startup (or on explicit CLI), verify pm2 supports stdin send:

- Send a harmless command (configurable), e.g. `/help` or `/list`
- Observe pm2 exit code; optionally also watch BDS output via pm2 logs to confirm receipt (bounded time)
- If unsupported:
  - Fail loudly with a clear message and next steps

### Fallback plan (if needed)
If pm2 send does not actually reach stdin on the platform/version:
- Provide an optional “stdin forwarder” sidecar:
  - Node process managed by pm2 that receives pm2 IPC messages and writes to a FIFO or directly to BDS stdin pipe (platform dependent)
- Keep it optional and well-documented; prefer pm2 native if available.

## 6) Minecraft listener (bedrock-protocol)

- Connect as client using configured `botName`
- Subscribe to:
  - chat packets/events (exact API depends on bedrock-protocol)
  - player list / add / remove packets (for presence)
- Strip formatting codes:
  - `§.` sequences (regex)
- Deduplicate:
  - ignore messages containing `relay.marker`
  - ignore messages whose hash matches recently relayed outbound (TTL cache)

## 7) Presence tracking (robust roster)

Implement `presence.ts` as a state machine:

- Primary signals:
  - PlayerList / PlayerAdded / PlayerRemoved packets
- Secondary signals:
  - Chat/system join/leave messages (heuristics)
- Optional reconciliation:
  - Periodic `/list` poll via stdin; parse output to reconcile roster (config flag)
- State:
  - `Map<string, { lastSeen: number, source: "packet"|"chat"|"list" }>`
- Expiration:
  - If a player hasn’t been seen in X minutes and no removal event, consider stale (configurable).

Expose APIs:
- `getRoster(): string[]`
- `onJoin`, `onLeave` events for relay if desired

## 8) Discord client (discord.js v14)

- Initialize intents needed for channel messages
- Do not act on bot’s own messages
- Listen only in configured channel
- Implement slash commands:
  - `/status`
  - `/reconnect`
  - `/say <text>` (admin-only)

Mention handling:
- Default: neutralize `@everyone` and `@here`
- Optional: allow user mentions when policy is `users`
- Never allow role mentions unless explicitly enabled (not default)

## 9) Relay core requirements

- Two independent directions with independent token buckets:
  - MC→DC and DC→MC
- Token bucket:
  - perSec + burst
- Dedupe LRU with TTL:
  - hash function: stable (sha256 truncated ok)
- Message splitting for MC outbound:
  - split on word boundaries
  - preserve prefix
- Never loop:
  - marker + hash cache

## 10) Logging

Use structured JSON logs:
- `pino` recommended
- Fields:
  - event, direction, user, len, reconnect_attempt, backoff_ms, roster_size

No secrets in logs.

## 11) Tests

Unit tests (no live network dependency) for:
- sanitize (mentions, markdown, newlines)
- split
- rate limit token bucket
- dedupe TTL + LRU eviction
- strip MC formatting
- presence tracking logic given simulated packet events
- some tests will need human intervention for full setup

## 12) Acceptance criteria

A run is successful when:
- MC chat appears in Discord quickly and consistently
- Discord chat appears in MC via stdin path consistently
- No echo loops
- Reconnect uses exponential backoff + jitter (no spam)
- Roster tracking is stable across disconnect/reconnect

## 13) Don’t do these dumb things

- Do not scrape BDS logs as the only source of truth.
- Do not shell out with `exec("pm2 send ...")` (injection risk).
- Do not store plaintext secrets on disk unless user explicitly chooses that.
- Do not block the event loop with heavy crypto in hot paths (encrypt/decrypt only at startup/CLI).

