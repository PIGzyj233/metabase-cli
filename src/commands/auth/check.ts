import { performance } from "node:perf_hooks";
import { Command } from "commander";
import { createApiClient } from "../../lib/api-client.js";
import { output } from "../../lib/formatter.js";
import { resolveCommandOutputOptions } from "../../lib/output-options.js";
import { handleCommandError } from "../../lib/errors.js";
import type { GlobalOptions } from "../../types/index.js";

export async function handleAuthCheck(opts: GlobalOptions) {
  const client = createApiClient(opts);
  const start = performance.now();
  const response = await client.get("/api/database");
  const databases = response?.data ?? response;
  if (!Array.isArray(databases)) {
    throw Object.assign(new Error("Metabase returned an invalid database listing during authentication check."), {
      code: "INVALID_RESPONSE",
      retryable: false,
      hint: "Check the instance URL and Metabase API compatibility.",
    });
  }
  return {
    reachable: true,
    authenticated: true,
    database_count: databases.length,
    elapsed_ms: Math.round(performance.now() - start),
  };
}

export function registerAuthCheckCommand(parent: Command): void {
  parent.command("check")
    .description("Verify authentication and database-list access against Metabase")
    .action(async function (this: Command) {
      const opts = this.optsWithGlobals() as GlobalOptions;
      try {
        output([await handleAuthCheck(opts)], resolveCommandOutputOptions(opts));
      } catch (error) {
        handleCommandError(error, opts);
      }
    });
}
