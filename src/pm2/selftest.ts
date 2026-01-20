import { pm2Send } from "./send";

export async function pm2SelfTest(target: string): Promise<boolean> {
  console.log(`Probe: Sending self-test to pm2 target '${target}'...`);
  try {
    // Send a harmless command.
    // If it's a BDS server, standard commands like 'list' or 'version' or just empty string?
    // /list is safe.
    await pm2Send(target, ["/list"]);
    console.log("Probe: Call returned success (exit code 0).");
    return true;
  } catch (err: any) {
    console.error(`Probe: Failed. ${err.message}`);
    console.error(
      "Ensure that pm2 is installed globally and the target process exists and is online."
    );
    return false;
  }
}
