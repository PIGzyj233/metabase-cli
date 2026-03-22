import { Command } from "commander";
import { createApiClient } from "../../lib/api-client.js";
import { output } from "../../lib/formatter.js";
import { handleCommandError, resolveOutputOptions, type DbCommandOptions } from "./common.js";

export async function handleDbList(opts: DbCommandOptions): Promise<any[]> {
  const client = createApiClient(opts);
  const response = await client.get("/api/database");
  return response.data || response;
}

export function registerDbListCommand(parent: Command): void {
  parent
    .command("list")
    .description("List all databases")
    .action(async (_localOpts, cmd) => {
      const opts = cmd.optsWithGlobals() as DbCommandOptions;
      try {
        const data = await handleDbList(opts);
        const simplified = data.map((db: any) => ({
          id: db.id,
          name: db.name,
          engine: db.engine,
        }));
        output(simplified, resolveOutputOptions(opts));
      } catch (error) {
        handleCommandError(error);
      }
    });
}
