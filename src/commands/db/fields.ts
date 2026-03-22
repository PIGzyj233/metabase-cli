import { Command } from "commander";
import { createApiClient } from "../../lib/api-client.js";
import { output } from "../../lib/formatter.js";
import {
  handleCommandError,
  parseRequiredId,
  resolveOutputOptions,
  type DbCommandOptions,
} from "./common.js";

export async function handleDbFields(
  tableId: number,
  opts: DbCommandOptions,
): Promise<any[]> {
  const client = createApiClient(opts);
  const metadata = await client.get(`/api/table/${tableId}/query_metadata`);
  return (metadata.fields || []).map((field: any) => ({
    id: field.id,
    name: field.name,
    database_type: field.database_type,
    description: field.description || null,
  }));
}

export function registerDbFieldsCommand(parent: Command): void {
  parent
    .command("fields <table-id>")
    .description("List fields of a table")
    .action(async (tableId: string, _localOpts, cmd) => {
      const opts = cmd.optsWithGlobals() as DbCommandOptions;
      try {
        const fields = await handleDbFields(parseRequiredId(tableId, "Table ID"), opts);
        output(fields, resolveOutputOptions(opts));
      } catch (error) {
        handleCommandError(error);
      }
    });
}
