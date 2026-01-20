import fs from 'fs/promises';
import readline from 'readline';
import { ConfigSchema, RelayConfig } from './types';
import { decryptJson, EncryptedPayload } from './crypto';

export async function loadEncryptedConfig(path: string): Promise<RelayConfig> {
  const password = await resolvePassword();
  const raw = await fs.readFile(path, 'utf8');
  const payload = JSON.parse(raw) as EncryptedPayload;
  const plain = await decryptJson(payload, password);
  return ConfigSchema.parse(plain);
}

export async function resolvePassword(): Promise<string> {
  const env = process.env.MC_RELAY_PASSWORD;
  if (env && env.length > 0) {
    return env;
  }
  if (!process.stdin.isTTY) {
    throw new Error('MC_RELAY_PASSWORD is required in non-interactive mode.');
  }
  return promptHidden('Config password: ');
}

function promptHidden(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const stdin = process.stdin;
    const onData = (char: Buffer) => {
      const charStr = char.toString('utf8');
      if (charStr === '\n' || charStr === '\r' || charStr === '\u0004') {
        stdin.removeListener('data', onData);
        return;
      }
      rl.output.write('*');
    };
    stdin.on('data', onData);
    rl.question(prompt, (answer) => {
      stdin.removeListener('data', onData);
      rl.close();
      resolve(answer);
    });
  });
}
