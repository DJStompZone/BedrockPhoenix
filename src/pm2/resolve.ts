import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export async function resolvePm2Id(target: string): Promise<string> {
  // If it's already a number, return it.
  if (/^\d+$/.test(target)) return target;

  try {
    const { stdout } = await execAsync("pm2 jlist");
    const processes = JSON.parse(stdout);
    const found = processes.find((p: any) => p.name === target);
    if (found) {
      return found.pm_id.toString();
    }
  } catch (e) {
    // Ignore error, return target letting consumer handle failure
  }
  return target;
}
