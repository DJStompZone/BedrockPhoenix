import { pm2Send } from './send';

export async function selftestPm2(target: string): Promise<void> {
  const code = await pm2Send(target, ['/help']);
  if (code !== 0) {
    throw new Error(`pm2 send failed with code ${code}. Verify pm2 is managing the BDS process and supports stdin send.`);
  }
}
