import { Command } from "commander";
import { loadConfig, saveConfig } from "../../lib/config.js";

export function handleAuthUse(alias: string): void {
  const config = loadConfig();
  if (!config.profiles?.[alias]) {
    const known = Object.keys(config.profiles ?? {});
    throw new Error(
      `Unknown Profile '${alias}'. Known Profiles: ${known.join(", ") || "(none)"}.`
    );
  }
  saveConfig({
    ...config,
    version: 2,
    current_profile: alias,
    profiles: config.profiles,
    hosts: {},
    current_host: null,
  });
  process.stderr.write(`Active Profile set to ${alias}.\n`);
}

export function registerAuthUseCommand(parent: Command): void {
  parent
    .command("use <alias>")
    .description("Set the Active Profile")
    .action((alias: string) => {
      try {
        handleAuthUse(alias);
      } catch (error: any) {
        process.stderr.write(`Error: ${error.message}\n`);
        process.exitCode = 1;
      }
    });
}
