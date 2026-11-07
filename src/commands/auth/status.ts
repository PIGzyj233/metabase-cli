import { Command } from "commander";
import { resolveStoredProfile } from "../../lib/auth.js";
import { output } from "../../lib/formatter.js";
import { resolveFormat } from "../../lib/config.js";
import { handleCommandError } from "../../lib/errors.js";
import type { GlobalOptions } from "../../types/index.js";

export interface AuthStatus {
  loggedIn: boolean;
  host?: string;
  tokenType?: string;
  username?: string;
  sourceId?: string;
  sourceUrl?: string;
}

export function getAuthStatus(opts: GlobalOptions = {}): AuthStatus {
  if (opts.host || opts.token) {
    throw new Error("auth status inspects saved Profiles. Use --profile instead of --host or --token.");
  }
  const identity = resolveStoredProfile(opts.profile || process.env.MB_PROFILE);
  if (!identity) {
    return { loggedIn: false };
  }

  return {
    loggedIn: true,
    host: identity.hostKey,
    tokenType: identity.tokenInfo.type,
    username: identity.username,
    sourceId: identity.sourceId,
    sourceUrl: identity.baseUrl,
  };
}

export function registerAuthStatusCommand(parent: Command): void {
  parent
    .command("status")
    .description("Show current authentication status")
    .action((localOpts, cmd) => {
      const globalOpts = cmd.optsWithGlobals() as GlobalOptions;
      try {
        const status = getAuthStatus(globalOpts);
        const outputOptions = {
          format: resolveFormat(globalOpts),
          json: globalOpts.json,
          jq: globalOpts.jq,
          omitHeader: globalOpts.omitHeader ?? globalOpts.header === false,
          sourceId: status.sourceId,
          sourceUrl: status.sourceUrl,
        };

        if (!status.loggedIn) {
          // Even "not logged in" should be structured for agent consumption
          output([{ loggedIn: false }], outputOptions);
          process.stderr.write("Not logged in. Run 'mb auth login' first.\n");
          return;
        }

        const record: Record<string, any> = {
          loggedIn: status.loggedIn,
          host: status.host,
          tokenType: status.tokenType,
        };
        if (status.username) {
          record.username = status.username;
        }

        output([record], outputOptions);
      } catch (error) {
        handleCommandError(error, globalOpts, { resolveSource: false });
      }
    });
}
