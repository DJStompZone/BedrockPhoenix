import * as crypto from "crypto";
import { util } from "zod";
import { promisify } from "util";
import { EncryptedConfig } from "./types";

const scryptAsync = promisify(crypto.scrypt);

const ALG = "aes-256-gcm";
const SCRYPT_PARAMS = {
  N: 16384,
  r: 8,
  p: 1,
  keyLen: 32,
};

export async function encryptConfig(
  plainJsonStr: string,
  password: string
): Promise<EncryptedConfig> {
  const salt = crypto.randomBytes(16);
  const key = (await (scryptAsync as any)(
    password,
    salt,
    SCRYPT_PARAMS.keyLen,
    {
      N: SCRYPT_PARAMS.N,
      r: SCRYPT_PARAMS.r,
      p: SCRYPT_PARAMS.p,
    }
  )) as Buffer;

  const nonce = crypto.randomBytes(12); // GCM standard nonce size
  const cipher = crypto.createCipheriv(ALG, key, nonce);

  let encrypted = cipher.update(plainJsonStr, "utf8", "base64");
  encrypted += cipher.final("base64");
  const tag = cipher.getAuthTag();

  return {
    version: 1,
    kdf: {
      name: "scrypt",
      salt_b64: salt.toString("base64"),
      N: SCRYPT_PARAMS.N,
      r: SCRYPT_PARAMS.r,
      p: SCRYPT_PARAMS.p,
    },
    cipher: {
      name: ALG,
      nonce_b64: nonce.toString("base64"),
    },
    ciphertext_b64: encrypted,
    tag_b64: tag.toString("base64"),
  };
}

export async function decryptConfig(
  encrypted: EncryptedConfig,
  password: string
): Promise<string> {
  if (encrypted.version !== 1) {
    throw new Error(`Unsupported config version: ${encrypted.version}`);
  }
  if (encrypted.kdf.name !== "scrypt") {
    throw new Error(`Unsupported KDF: ${encrypted.kdf.name}`);
  }
  if (encrypted.cipher.name !== "aes-256-gcm") {
    throw new Error(`Unsupported cipher: ${encrypted.cipher.name}`);
  }

  const salt = Buffer.from(encrypted.kdf.salt_b64, "base64");
  const key = (await (scryptAsync as any)(password, salt, 32, {
    N: encrypted.kdf.N,
    r: encrypted.kdf.r,
    p: encrypted.kdf.p,
  })) as Buffer;

  const nonce = Buffer.from(encrypted.cipher.nonce_b64, "base64");
  const tag = Buffer.from(encrypted.tag_b64, "base64");

  const decipher = crypto.createDecipheriv(ALG, key, nonce);
  decipher.setAuthTag(tag);

  let decrypted = decipher.update(encrypted.ciphertext_b64, "base64", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}
