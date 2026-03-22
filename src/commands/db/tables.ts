import { Command } from "commander";
import { createApiClient } from "../../lib/api-client.js";
import { output } from "../../lib/formatter.js";
import {
  handleCommandError,
  parseRequiredId,
  resolveOutputOptions,
  type DbTablesOptions,
} from "./common.js";

export async function handleDbTables(
  dbId: number,
  opts: DbTablesOptions,
): Promise<any[]> {
  const client = createApiClient(opts);

  if (opts.schema) {
    const response = await client.get(
      `/api/database/${dbId}/schema/${encodeURIComponent(opts.schema)}`,
    );
    return Array.isArray(response) ? response : response.tables || [];
  }

  const metadata = await client.get(`/api/database/${dbId}/metadata`);
  return metadata.tables || [];
}

export function registerDbTablesCommand(parent: Command): void {
  parent
    .command("tables <db-id>")
    .description("List tables in a database")
    .option("--schema <name>", "Filter by schema name")
    .action(async (dbId: string, _localOpts, cmd) => {
      const opts = cmd.optsWithGlobals() as DbTablesOptions;
      try {
        const tables = await handleDbTables(parseRequiredId(dbId, "Database ID"), opts);
        const simplified = tables.map((table: any) => ({
          id: table.id,
          name: table.name,
          schema: table.schema,
        }));
        output(simplified, resolveOutputOptions(opts));
      } catch (error) {
        handleCommandError(error);
      }
    });
}
