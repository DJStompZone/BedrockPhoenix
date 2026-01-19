# BedrockPhoenix

A bidirectional chat relay between a **vanilla Minecraft Bedrock Dedicated Server (BDS)** and a **Discord text channel**.

## Why this architecture?

There is a known/observed reliability issue when sending certain chat-bound packets via the Bedrock client protocol path (packet loss / dropped outbound messages). So the bridge is intentionally split:

- **bedrock-protocol** is used **only to join and listen** to in-game chat + presence packets.
- **Discord → Minecraft** messages are delivered by writing to the **BDS process STDIN** via `pm2 send <proc> ...`.

This keeps inbound parsing modern and robust while using the server’s native input path for outbound messages.

---

## Quick start

### 1) Prereqs
- Node.js 20+ (recommended)
- `pm2` installed globally:
  - `npm i -g pm2`
- A running Bedrock Dedicated Server that you can reach from the relay host
- A Discord bot token (and message content intent enabled)

### 2) Run BDS under pm2
You need BDS managed by pm2 so we can send stdin lines.

Example:

```bash
pm2 start ./bedrock_server --name bds --interpreter none
pm2 save
```

> Important: this project assumes your pm2 version supports `pm2 send <id|name> <argv...>` forwarding to the process STDIN (see Troubleshooting if it doesn’t).

### 3) Install and build
```bash
npm install
npm run build
```

### 4) Configure
This project uses **one single encrypted JSON config file** on disk.

Create a config (plaintext template is provided) then encrypt it:

```bash
cp config/config.template.json config/config.json
node dist/cli.js encrypt-config --in config/config.json --out config/config.enc.json
```

Run the app (you will be prompted for the password unless you provide it via env var):

```bash
node dist/main.js --config config/config.enc.json
```

---

## Configuration

All user configuration lives in one JSON object. The encrypted file contains:

- Discord:
  - token
  - guildId
  - channelId
  - adminUserIds (optional)
- Minecraft:
  - host
  - port (default 19132)
  - botName (bridge player name)
- pm2 / BDS:
  - pm2Target (process name or id)
  - sendArgsTemplate (how to format stdin lines, e.g. `/say {text}`)
- Relay:
  - prefixes
  - mention policy
  - rate limits
  - dedupe TTL / sizes
  - message length limits

See `config/config.template.json`.

### Encryption
Config encryption is required:
- Use a password provided by the user at runtime.
- Derive key using `scrypt` (or `argon2` if chosen) with a per-file salt.
- Encrypt using **AES-256-GCM** with random nonce/IV.
- File stores: `{ version, kdf, salt, nonce, ciphertext, tag }` (base64 where appropriate).

---

## Runtime behavior

### Minecraft → Discord
- Bridge joins the server with `bedrock-protocol`
- On chat packet, relay to Discord as: `**<mc_user>**: message`
- Strip Minecraft formatting codes (`§x` sequences)
- Suppress relay markers / self-generated loops

### Discord → Minecraft
- On new Discord message in configured channel **not from the bot**
- Sanitize:
  - collapse newlines
  - remove/neutralize mentions per policy
  - strip markdown noise
- Format: `<discord_name>: message`
- Send to BDS by invoking:
  - `pm2 send <pm2Target> <argv...>`
- Apply rate limits, splitting, and dedupe guards

---

## Presence tracking (who is online)

We maintain a robust online player roster by combining:

1) **Bedrock protocol player list / add / remove signals** (preferred)
2) **Heuristic join/leave detection** from chat/system messages (fallback)
3) Optional periodic `/list` poll via stdin, parsing the server response to reconcile (configurable)

This yields a resilient model even across reconnects and packet quirks.

---

## Commands (Discord)

- `/status` – shows MC connection status, Discord status, roster size, last message times
- `/reconnect` – forces the MC listener to reconnect with backoff reset
- `/say <text>` – (admin-only) send arbitrary text to the BDS stdin path

Admin users are configured via `adminUserIds`.

---

## Development

```bash
npm run dev
npm test
npm run lint
```

---

## Troubleshooting

### “pm2 send” doesn’t write to stdin
Different pm2 builds/versions behave differently. This project expects the newer behavior where `pm2 send` forwards argv to process stdin for non-node apps as well. If your pm2 doesn’t, the app should:
- Detect unsupported behavior at startup (self-test)
- Fail loudly with clear remediation instructions

Possible remediation paths:
- upgrade pm2
- run a tiny “stdin forwarder” process under pm2 that pipes pm2 messages to the BDS stdin (documented in AGENTS.md)

### Bridge can’t join the server
- Ensure `host:port` is reachable (UDP)
- Confirm server allows the bridge name / slots available
- Review logs (JSON structured logs by default)

---

## License
MIT (or your preferred license).
