# BedrockPhoenix

A production-ready relay between a **vanilla Minecraft Bedrock Dedicated Server (BDS)** and a **Discord text channel**.

## Why this architecture?

There is a known/observed reliability issue when sending chat via the Bedrock client protocol path. This project intentionally splits responsibilities:

- **bedrock-protocol** is used **only for listening** to Minecraft chat + presence.
- **Discord → Minecraft** messages are delivered by writing to **BDS STDIN** via `pm2 send <proc> <argv...>`.

This keeps inbound parsing reliable while using the server’s native stdin path for outbound messages.

---

## Quick start

### 1) Prereqs
- Node.js 20+
- `pm2` installed globally (`npm i -g pm2`)
- A running Bedrock Dedicated Server reachable from the relay host
- A Discord bot token (message content intent enabled)

### 2) Run BDS under pm2
You need BDS managed by pm2 so we can send stdin lines:

```bash
pm2 start ./bedrock_server --name bds --interpreter none
pm2 save
```

> This project assumes `pm2 send <id|name> <argv...>` forwards argv to process stdin.

### 3) Install and build
```bash
npm install
npm run build
```

### 4) Configure (single encrypted JSON)
Copy the template and encrypt it:

```bash
cp src/config/config.template.json config.json
node dist/cli.js encrypt-config --in config.json --out config.enc.json
```

Run the app (you will be prompted for the password unless `MC_RELAY_PASSWORD` is set):

```bash
MC_RELAY_PASSWORD=your-password node dist/main.js
```

---

## CLI

```bash
node dist/cli.js encrypt-config --in config.json --out config.enc.json
node dist/cli.js decrypt-config --in config.enc.json --out config.json
node dist/cli.js validate-config --config config.enc.json
node dist/cli.js selftest-pm2 --target bds
```

`MC_RELAY_PASSWORD` may be used for non-interactive environments.

---

## Configuration

All configuration lives in one JSON object (encrypted on disk):

- `discord`: token, guildId, channelId, adminUserIds
- `minecraft`: host, port, botName
- `pm2`: target, sendArgsTemplate
- `relay`: mention policy, max lengths, rate limits, dedupe settings
- `observability`: log level + human-friendly logs

See `src/config/config.template.json` for a full example.

### Encryption
- **KDF:** `scrypt` (N=16384, r=8, p=1)
- **Cipher:** `aes-256-gcm`
- Random per-file salt + nonce

---

## Runtime behavior

### Minecraft → Discord
- Bridge joins the server with `bedrock-protocol`
- On chat packet, relay to Discord as: `username: message`
- Strip Minecraft formatting codes (`§x` sequences)
- Suppress relay markers and dedupe recent messages

### Discord → Minecraft
- On new Discord message in configured channel **not from the bot**
- Sanitize: collapse newlines, neutralize mentions/roles per policy
- Format: `username: message [relay]`
- Send to BDS by invoking `pm2 send <target> <argv...>`
- Apply rate limits, splitting, and dedupe guards

---

## Presence tracking (who is online)

The relay maintains a roster using:

1) Player list add/remove packets (preferred)
2) Join/leave heuristics from system chat
3) Optional `/list` reconciliation (parse output when observed)

---

## Discord slash commands

- `/status` – show relay status and roster size
- `/reconnect` – reconnect the Bedrock listener (admin-only)
- `/list` – show current roster
- `/kick <player>` – send `/kick` to BDS (admin-only)
- `/restart` – send `/stop` to BDS (admin-only)

---

## Development

```bash
npm test
npm run lint
npm run build
```

---

## Troubleshooting

### “pm2 send” doesn’t write to stdin
If your pm2 build does not forward stdin, run the self-test:

```bash
node dist/cli.js selftest-pm2 --target bds
```

Upgrade pm2 if needed, or add a documented stdin-forwarder sidecar as described in `AGENTS.md`.

---

## License
MIT (or your preferred license).
