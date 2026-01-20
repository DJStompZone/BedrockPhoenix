import { spawn } from "child_process";
import { Config } from "../config/types";

export async function pm2Send(target: string, args: string[]): Promise<void> {
  // target is process ID/name
  // args are the arguments to send to stdin
  // pm2 send <target> <arg1> <arg2> ...
  // Note: pm2 send simply concatenates args with spaces usually when forwarding to stdin,
  // or passes them as argv if the target expects it.
  // The spec says: "Use child_process.spawn('pm2', ['send', target, ...argv])"

  return new Promise((resolve, reject) => {
    const proc = spawn("pm2", ["send", target, ...args], {
      stdio: "ignore", // We don't need output? Maybe we want stderr on error?
      // Spec says stdio: 'ignore'.
    });

    proc.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`pm2 send failed with code ${code}`));
      }
    });

    proc.on("error", (err) => {
      reject(err);
    });
  });
}
