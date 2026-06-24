import { Command } from "commander";
import { createApiClient } from "../../lib/api-client.js";
import { projectDatabase } from "../../lib/agent-projections.js";
import { output } from "../../lib/formatter.js";
import { handleCommandError, resolveOutputOptions, type DbCommandOptions } from "./common.js";

export async function handleDbList(opts: DbCommandOptions): Promise<any[]> {
  const client = createApiClient(opts);
  const response = await client.get("/api/database");
  return (response.data || response).map(projectDatabase);
}

export function registerDbListCommand(parent: Command): void {
  parent
    .command("list")
    .description("List all databases")
    .action(async (_localOpts, cmd) => {
      const opts = cmd.optsWithGlobals() as DbCommandOptions;
      try {
        const data = await handleDbList(opts);
        output(data, resolveOutputOptions(opts));
      } catch (error) {
        handleCommandError(error, opts);
      }
    });
}
