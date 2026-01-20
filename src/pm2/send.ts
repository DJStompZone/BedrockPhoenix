import { spawn } from 'child_process';

export async function pm2Send(target: string, argv: string[]): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = spawn('pm2', ['send', target, ...argv], { stdio: 'ignore' });
    child.on('error', (err) => reject(err));
    child.on('close', (code) => resolve(code ?? 1));
  });
}
