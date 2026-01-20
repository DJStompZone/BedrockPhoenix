import fs from 'fs/promises';
import { encryptJson, decryptJson, EncryptedPayload, describeKdf } from './config/crypto';
import { ConfigSchema } from './config/types';
import { resolvePassword } from './config/load';
import { selftestPm2 } from './pm2/selftest';

async function run(): Promise<void> {
  const [command, ...rest] = process.argv.slice(2);
  const args = parseArgs(rest);

  switch (command) {
    case 'encrypt-config': {
      const input = args['in'];
      const output = args['out'];
      if (!input || !output) {
        throw new Error('Usage: encrypt-config --in <plain.json> --out <enc.json>');
      }
      const password = await resolvePassword();
      const raw = await fs.readFile(input, 'utf8');
      const plain = JSON.parse(raw);
      const payload = await encryptJson(plain, password);
      await fs.writeFile(output, JSON.stringify(payload, null, 2));
      // eslint-disable-next-line no-console
      console.log(`Encrypted config written to ${output} using ${describeKdf()}`);
      return;
    }
    case 'decrypt-config': {
      const input = args['in'];
      const output = args['out'];
      if (!input || !output) {
        throw new Error('Usage: decrypt-config --in <enc.json> --out <plain.json>');
      }
      const password = await resolvePassword();
      const raw = await fs.readFile(input, 'utf8');
      const payload = JSON.parse(raw) as EncryptedPayload;
      const plain = await decryptJson(payload, password);
      await fs.writeFile(output, JSON.stringify(plain, null, 2));
      // eslint-disable-next-line no-console
      console.log(`Decrypted config written to ${output}`);
      return;
    }
    case 'validate-config': {
      const configPath = args['config'];
      if (!configPath) {
        throw new Error('Usage: validate-config --config <enc.json>');
      }
      const password = await resolvePassword();
      const raw = await fs.readFile(configPath, 'utf8');
      const payload = JSON.parse(raw) as EncryptedPayload;
      const plain = await decryptJson(payload, password);
      ConfigSchema.parse(plain);
      // eslint-disable-next-line no-console
      console.log('Config valid.');
      return;
    }
    case 'selftest-pm2': {
      const target = args['target'];
      if (!target) {
        throw new Error('Usage: selftest-pm2 --target <name|id>');
      }
      await selftestPm2(target);
      // eslint-disable-next-line no-console
      console.log('pm2 send self-test succeeded.');
      return;
    }
    default:
      throw new Error(`Unknown command: ${command ?? 'none'}`);
  }
}

function parseArgs(args: string[]): Record<string, string> {
  const parsed: Record<string, string> = {};
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      parsed[arg.slice(2)] = args[i + 1];
      i += 1;
    }
  }
  return parsed;
}

run().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
