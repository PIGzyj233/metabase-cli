import { Command } from "commander";
import { createApiClient } from "../../lib/api-client.js";
import { projectTable } from "../../lib/agent-projections.js";
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
    const tables = Array.isArray(response) ? response : response.tables || [];
    return tables.map(projectTable);
  }

  const metadata = await client.get(`/api/database/${dbId}/metadata`);
  return (metadata.tables || []).map(projectTable);
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
        output(tables, resolveOutputOptions(opts));
      } catch (error) {
        handleCommandError(error);
      }
    });
}
