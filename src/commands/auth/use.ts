import { Command } from "commander";
import { handleCommandError } from "../../lib/errors.js";
import { outputOperationResult, type OperationResult } from "../../lib/operation-result.js";
import { loadConfig, saveConfig } from "../../lib/config.js";

export function handleAuthUse(alias: string): OperationResult {
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
  return { sourceId: alias, sourceUrl: config.profiles[alias].instance,
    record: { operation: "use", ok: true, profile: alias, status: "active" } };
}

export function registerAuthUseCommand(parent: Command): void {
  parent
    .command("use <alias>")
    .description("Set the Active Profile")
    .action(function (this: Command, alias: string) {
      try {
        outputOperationResult(handleAuthUse(alias), this.optsWithGlobals());
      } catch (error: any) {
        handleCommandError(error, this.optsWithGlobals(), { resolveSource: false, sourceId: alias });
      }
    });
}
