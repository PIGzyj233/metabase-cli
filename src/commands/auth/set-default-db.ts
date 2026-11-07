import { Command } from "commander";
import { resolveStoredProfile } from "../../lib/auth.js";
import { loadConfig, resolveFormat, saveConfig } from "../../lib/config.js";
import { parsePositiveInteger } from "../../lib/input-validation.js";
import { output } from "../../lib/formatter.js";
import { handleCommandError } from "../../lib/errors.js";
import { CliError } from "../../lib/cli-error.js";
import type { GlobalOptions } from "../../types/index.js";

export function handleAuthSetDefaultDb(dbId: string | number, opts: GlobalOptions) {
  const databaseId = parsePositiveInteger(dbId, "Database ID");
  if (opts.host || opts.token) {
    throw new Error("auth set-default-db updates a saved Profile. Use --profile instead of --host or --token.");
  }
  const identity = resolveStoredProfile(opts.profile || process.env.MB_PROFILE);
  if (!identity) throw new CliError("CONFIGURATION_ERROR", "No saved Profile selected.", "Run 'mb auth login' or use --profile first.");
  const config = loadConfig();
  const profile = config.profiles?.[identity.sourceId];
  if (!profile || profile.instance !== identity.baseUrl || profile.token !== identity.tokenInfo.token) {
    throw new Error(`Profile '${identity.sourceId}' changed while setting its default database. Retry the command.`);
  }
  profile.default_db = databaseId;
  saveConfig(config);
  return {
    record: { operation: "set-default-db", profile: identity.sourceId, default_db: databaseId },
    sourceId: identity.sourceId,
    sourceUrl: identity.baseUrl,
  };
}

export function registerAuthSetDefaultDbCommand(parent: Command): void {
  parent.command("set-default-db <db-id>")
    .description("Set the selected Profile's default database locally without switching the Active Profile")
    .action(function (this: Command, dbId: string) {
      const opts = this.optsWithGlobals() as GlobalOptions;
      try {
        const result = handleAuthSetDefaultDb(dbId, opts);
        output([result.record], {
          format: resolveFormat(opts), json: opts.json, jq: opts.jq,
          omitHeader: opts.omitHeader ?? opts.header === false,
          sourceId: result.sourceId, sourceUrl: result.sourceUrl,
        });
      } catch (error) {
        // Inventory operations ignore bare-override environment variables.
        handleCommandError(error, opts, { resolveSource: false });
      }
    });
}
