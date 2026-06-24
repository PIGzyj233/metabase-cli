import { Command } from "commander";
import { loadConfig } from "../../lib/config.js";
import { output } from "../../lib/formatter.js";
import { resolveCommandOutputOptions } from "../../lib/output-options.js";
import type { GlobalOptions } from "../../types/index.js";

export interface AuthListRow {
  _source: string;
  alias: string;
  instance: string;
  tokenType: "api_key" | "session";
  username?: string;
  active: boolean;
}

export function getAuthList(): AuthListRow[] {
  const config = loadConfig();
  return Object.entries(config.profiles ?? {}).map(([alias, profile]) => ({
    _source: alias,
    alias,
    instance: profile.instance,
    tokenType: profile.token_type,
    ...(profile.username ? { username: profile.username } : {}),
    active: config.current_profile === alias,
  }));
}

export function registerAuthListCommand(parent: Command): void {
  parent
    .command("list")
    .description("List saved Profiles")
    .action(function (this: Command) {
      const opts = this.optsWithGlobals() as GlobalOptions;
      output(getAuthList(), resolveCommandOutputOptions(opts));
    });
}
