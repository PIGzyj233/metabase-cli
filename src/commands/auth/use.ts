import { Command } from "commander";
import { handleCommandError } from "../../lib/errors.js";
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
    .action(function (this: Command, alias: string) {
      try {
        handleAuthUse(alias);
      } catch (error: any) {
        handleCommandError(error, this.optsWithGlobals(), { resolveSource: false, sourceId: alias });
      }
    });
}
