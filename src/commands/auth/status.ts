import { Command } from "commander";
import { resolveProfile } from "../../lib/auth.js";
import { output } from "../../lib/formatter.js";
import { resolveCommandOutputOptions } from "../../lib/output-options.js";
import type { GlobalOptions } from "../../types/index.js";

export interface AuthStatus {
  loggedIn: boolean;
  host?: string;
  tokenType?: string;
  username?: string;
}

export function getAuthStatus(opts: GlobalOptions = {}): AuthStatus {
  const identity = resolveProfile(opts);
  if (!identity) {
    return { loggedIn: false };
  }

  return {
    loggedIn: true,
    host: identity.hostKey,
    tokenType: identity.tokenInfo.type,
    username: identity.kind === "profile" ? identity.username : undefined,
  };
}

export function registerAuthStatusCommand(parent: Command): void {
  parent
    .command("status")
    .description("Show current authentication status")
    .action((localOpts, cmd) => {
      const globalOpts = cmd.optsWithGlobals() as GlobalOptions;
      const status = getAuthStatus(globalOpts);

      if (!status.loggedIn) {
        // Even "not logged in" should be structured for agent consumption
        output([{ loggedIn: false }], {
          format: globalOpts.format,
          json: globalOpts.json,
          jq: globalOpts.jq,
          omitHeader: globalOpts.omitHeader ?? globalOpts.header === false,
        });
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

      output([record], resolveCommandOutputOptions(globalOpts));
    });
}
