import crypto from 'crypto';
import { promisify } from 'util';

const scryptAsync = promisify(crypto.scrypt);

export type EncryptedPayload = {
  version: 1;
  kdf: { name: 'scrypt'; salt_b64: string; N: number; r: number; p: number };
  cipher: { name: 'aes-256-gcm'; nonce_b64: string };
  ciphertext_b64: string;
  tag_b64: string;
};

const KDF_PARAMS = { N: 16384, r: 8, p: 1 } as const;
const KEY_LEN = 32;

export async function deriveKey(password: string, salt: Buffer): Promise<Buffer> {
  return (await scryptAsync(password, salt, KEY_LEN, KDF_PARAMS)) as Buffer;
}

export async function encryptJson(plain: unknown, password: string): Promise<EncryptedPayload> {
  const salt = crypto.randomBytes(16);
  const nonce = crypto.randomBytes(12);
  const key = await deriveKey(password, salt);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, nonce);
  const plaintext = Buffer.from(JSON.stringify(plain), 'utf8');
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();

  return {
    version: 1,
    kdf: { name: 'scrypt', salt_b64: salt.toString('base64'), ...KDF_PARAMS },
    cipher: { name: 'aes-256-gcm', nonce_b64: nonce.toString('base64') },
    ciphertext_b64: ciphertext.toString('base64'),
    tag_b64: tag.toString('base64'),
  };
}

export async function decryptJson(payload: EncryptedPayload, password: string): Promise<unknown> {
  if (payload.version !== 1 || payload.kdf.name !== 'scrypt' || payload.cipher.name !== 'aes-256-gcm') {
    throw new Error('Unsupported encryption format.');
  }
  const salt = Buffer.from(payload.kdf.salt_b64, 'base64');
  const nonce = Buffer.from(payload.cipher.nonce_b64, 'base64');
  const tag = Buffer.from(payload.tag_b64, 'base64');
  const ciphertext = Buffer.from(payload.ciphertext_b64, 'base64');

  const key = await scryptAsync(password, salt, KEY_LEN, {
    N: payload.kdf.N,
    r: payload.kdf.r,
    p: payload.kdf.p,
  });
  const decipher = crypto.createDecipheriv('aes-256-gcm', key as Buffer, nonce);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return JSON.parse(plaintext.toString('utf8'));
}

export function describeKdf(): string {
  return `scrypt N=${KDF_PARAMS.N} r=${KDF_PARAMS.r} p=${KDF_PARAMS.p}`;
}
