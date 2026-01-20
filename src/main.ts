import { loadConfig } from "./config/load";
import { DiscordBot } from "./discord/client";
import { Listener } from "./mc/listener";
import { Presence } from "./mc/presence";
import { RelayCore } from "./relay/relayCore";
import * as readline from "readline";

async function getPassword(): Promise<string> {
  const envPass = process.env.MC_RELAY_PASSWORD;
  if (envPass) return envPass;

  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    rl.question("Enter config password: ", (answer) => {
      rl.close();
      resolve(answer);
    });

    // Simple mute?
    // rl._writeToOutput = (stringToWrite) => { if (stringToWrite.trim() !== '\n') rl.output.write('*'); };
    // Too complex for standard rl. Users can use env var for silence.
  });
}

import { createLogger } from "./logger";

async function main() {
  const args = process.argv.slice(2);
  const configPathId = args.indexOf("--config");
  const configPath =
    configPathId >= 0 ? args[configPathId + 1] : "./config/config.enc.json";

  console.log(`Loading config from ${configPath}...`); // Use console before logger init

  try {
    const config = await loadConfig(configPath, getPassword);

    const logger = createLogger(config);
    logger.info("Configuration loaded.");

    const presence = new Presence(600000); // 10 min expiry default
    const discord = new DiscordBot(config); // DiscordBot might need logger too?
    // Spec didn't force logger on DiscordBot but good practice.
    // For now, let's just update Listener and RelayCore if needed.
    // Spec says "Relay Core ... integrates ... Logging".

    // We updated Listener constructor to take logger.
    const mc = new Listener(config, presence, logger);

    // RelayCore also used console.warn/error in my implementation.
    // Ideally it should take logger too, but I haven't updated RelayCore constructor yet.
    // I should probably pass logger to RelayCore too.

    const relay = new RelayCore(config, discord, mc, presence, logger);

    logger.info("Starting Relay...");
    await relay.start();

    // Handle signals
    process.on("SIGINT", () => {
      logger.info("Shutting down...");
      mc.disconnect();
      discord.client.destroy();
      process.exit(0);
    });
  } catch (err) {
    console.error("Fatal error:", err);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
