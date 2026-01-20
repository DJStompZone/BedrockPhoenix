import { Command } from "commander";
import * as fs from "fs/promises";
import prompts from "prompts";
import { encryptConfig, decryptConfig } from "./config/crypto";
import { Config, ConfigSchema, EncryptedConfig } from "./config/types";
import { pm2SelfTest } from "./pm2/selftest";
import * as readline from "readline";

const program = new Command();

async function getPassword(prompt: string = "Password: "): Promise<string> {
  if (process.env.MC_RELAY_PASSWORD) return process.env.MC_RELAY_PASSWORD;

  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.question(prompt, (ans) => {
      rl.close();
      resolve(ans);
    });
  });
}

program.name("brphoenix-cli").description("CLI for BedrockPhoenix Relay");

program
  .command("encrypt-config")
  .requiredOption("--in <path>", "Input plain JSON config")
  .requiredOption("--out <path>", "Output encrypted config")
  .action(async (options) => {
    try {
      const plain = await fs.readFile(options.in, "utf8");
      // Validate first
      try {
        ConfigSchema.parse(JSON.parse(plain));
      } catch (e: any) {
        console.error(
          "Validation failed for input config:",
          e.errors || e.message
        );
        process.exit(1);
      }

      const password = await getPassword("Enter password to encrypt: ");
      const encrypted = await encryptConfig(plain, password);

      await fs.writeFile(options.out, JSON.stringify(encrypted, null, 2));
      console.log(`Encrypted config written to ${options.out}`);
    } catch (err: any) {
      console.error("Error:", err.message);
    }
  });

program
  .command("decrypt-config")
  .requiredOption("--in <path>", "Input encrypted config")
  .requiredOption("--out <path>", "Output plain JSON config")
  .action(async (options) => {
    try {
      const encryptedStr = await fs.readFile(options.in, "utf8");
      const encrypted: EncryptedConfig = JSON.parse(encryptedStr);

      const password = await getPassword("Enter password to decrypt: ");
      const plain = await decryptConfig(encrypted, password);

      await fs.writeFile(options.out, plain);
      console.log(`Decrypted config written to ${options.out}`);
    } catch (err: any) {
      console.error("Error:", err.message);
    }
  });

program
  .command("validate-config")
  .requiredOption("--config <path>", "Encrypted config path")
  .action(async (options) => {
    try {
      const encryptedStr = await fs.readFile(options.config, "utf8");
      const encrypted: EncryptedConfig = JSON.parse(encryptedStr);
      const password = await getPassword("Enter password: ");
      const plain = await decryptConfig(encrypted, password);
      ConfigSchema.parse(JSON.parse(plain));
      console.log("Config is valid.");
    } catch (err: any) {
      console.error("Validation failed:", err.message);
      process.exit(1);
    }
  });

program
  .command("selftest-pm2")
  .requiredOption("--target <target>", "PM2 process name or ID")
  .action(async (options) => {
    const success = await pm2SelfTest(options.target);
    if (!success) process.exit(1);
  });

program
  .command("init-config")
  .description("Interactive wizard to create a new configuration file")
  .option(
    "--out <path>",
    "Output path (will be encrypted if password provided, else plain)",
    "config/config.json"
  )
  .action(async (options) => {
    console.log("Welcome to BedrockPhoenix Config Wizard!");

    // Default template data
    const response = await prompts([
      {
        type: "text",
        name: "token",
        message: "Discord Bot Token:",
        validate: (val) => (val.length > 10 ? true : "Token seems too short"),
      },
      {
        type: "text",
        name: "guildId",
        message: "Discord Guild ID (Server ID):",
        validate: (val) => (/^\d+$/.test(val) ? true : "Must be numeric"),
      },
      {
        type: "text",
        name: "channelId",
        message: "Discord Channel ID (where chat relays):",
        validate: (val) => (/^\d+$/.test(val) ? true : "Must be numeric"),
      },
      {
        type: "text",
        name: "adminId",
        message: "Admin User ID (optional, comma separated):",
      },
      {
        type: "text",
        name: "mcHost",
        message: "Minecraft Server IP:",
        initial: "127.0.0.1",
      },
      {
        type: "number",
        name: "mcPort",
        message: "Minecraft Server Port:",
        initial: 19132,
      },
      {
        type: "text",
        name: "botName",
        message: "Bot Username (listener):",
        initial: "RelayBot",
      },
      {
        type: "text",
        name: "pm2Target",
        message: "PM2 Process Name/ID (of the Bedrock Server):",
        initial: "bds",
      },
      {
        type: "confirm",
        name: "encrypt",
        message: "Do you want to encrypt this config now? (Recommended)",
        initial: true,
      },
      {
        type: (prev) => (prev ? "password" : null),
        name: "password",
        message: "Enter config password:",
        validate: (val) => (val.length > 0 ? true : "Password required"),
      },
    ]);

    if (!response.token) return; // User cancelled

    const config: Config = {
      discord: {
        token: response.token,
        guildId: response.guildId,
        channelId: response.channelId,
        adminUserIds: response.adminId
          ? response.adminId.split(",").map((s: string) => s.trim())
          : [],
      },
      minecraft: {
        host: response.mcHost,
        port: response.mcPort,
        botName: response.botName,
      },
      pm2: {
        target: response.pm2Target,
        // Use default template for args
        sendArgsTemplate: [
          "/tellraw",
          "@a",
          '{"rawtext":[{"text":"[Discord] "},{"text":"§b{username}§r: {message}"}]}',
        ],
      },
      relay: {
        mentionPolicy: "none",
        maxDiscordLen: 1800,
        maxMcLen: 200,
        rateLimitPerSec: 2,
        rateLimitBurst: 5,
        dedupeTtlSec: 30,
        dedupeMaxEntries: 200,
      },
      observability: {
        logLevel: "info",
        logHuman: true,
      },
    };

    // Validate generated config
    try {
      ConfigSchema.parse(config);
    } catch (e: any) {
      console.error("Generated config is invalid:", e.errors);
      return;
    }

    if (response.encrypt) {
      // Encrypt
      const json = JSON.stringify(config);
      const encrypted = await encryptConfig(json, response.password);

      // Determine output path. If user didn't specify .enc, add it if they didn't manually set output?
      // But options.out is default config/config.json.
      // If encrypting, better to default to config.enc.json?
      let outPath = options.out;
      if (outPath === "config/config.json") outPath = "config/config.enc.json";

      await fs.writeFile(outPath, JSON.stringify(encrypted, null, 2));
      console.log(`\nSuccess! Encrypted config saved to ${outPath}`);
    } else {
      await fs.writeFile(options.out, JSON.stringify(config, null, 2));
      console.log(`\nSuccess! Plain config saved to ${options.out}`);
      console.log(
        'Remember to encrypt it later using "encrypt-config" before deploying in unsafe environments.'
      );
    }
  });

program.parse();
