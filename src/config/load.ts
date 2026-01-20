import * as fs from "fs/promises";
import { Config, ConfigSchema, EncryptedConfig } from "./types";
import { decryptConfig } from "./crypto";

export async function loadConfig(
  path: string,
  passwordProvider: () => Promise<string>
): Promise<Config> {
  let fileContent: string;
  try {
    fileContent = await fs.readFile(path, "utf8");
  } catch (err: any) {
    throw new Error(`Failed to read config file at ${path}: ${err.message}`);
  }

  let encrypted: EncryptedConfig;
  try {
    encrypted = JSON.parse(fileContent);
  } catch (err: any) {
    throw new Error(`Failed to parse config JSON: ${err.message}`);
  }

  const password = await passwordProvider();
  const decryptedJson = await decryptConfig(encrypted, password);

  let plain: unknown;
  try {
    plain = JSON.parse(decryptedJson);
  } catch (err: any) {
    throw new Error(`Decrypted config is not valid JSON: ${err.message}`);
  }

  return ConfigSchema.parse(plain);
}
