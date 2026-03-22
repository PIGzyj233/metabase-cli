import { Command } from "commander";
import { resolveToken } from "../../lib/auth.js";
import { loadConfig, resolveHost } from "../../lib/config.js";
import { output } from "../../lib/formatter.js";
import type { GlobalOptions } from "../../types/index.js";

export interface AuthStatus {
  loggedIn: boolean;
  host?: string;
  tokenType?: string;
  username?: string;
}

export function getAuthStatus(opts: GlobalOptions = {}): AuthStatus {
  // Use the full auth priority chain: CLI --token > env vars > config file
  const tokenInfo = resolveToken(opts);
  const host = resolveHost(opts);

  if (!tokenInfo) {
    return { loggedIn: false };
  }

  // Resolve username from config if available
  const config = loadConfig();
  const configHost = host ? config.hosts[host] : undefined;
  const username = configHost?.username;

  return {
    loggedIn: true,
    host: host || "(env/cli override)",
    tokenType: tokenInfo.type,
    username,
  };
}

export function registerAuthStatusCommand(parent: Command): void {
  parent
    .command("status")
    .description("Show current authentication status")
    .action((localOpts, cmd) => {
      const globalOpts = cmd.optsWithGlobals() as GlobalOptions;
      const status = getAuthStatus(globalOpts);
      const omitHeader = globalOpts.omitHeader ?? globalOpts.header === false;

      if (!status.loggedIn) {
        // Even "not logged in" should be structured for agent consumption
        output([{ loggedIn: false }], {
          format: globalOpts.format,
          json: globalOpts.json,
          jq: globalOpts.jq,
          omitHeader,
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

      output([record], {
        format: globalOpts.format,
        json: globalOpts.json,
        jq: globalOpts.jq,
        omitHeader,
      });
    });
}
