import { Command } from "commander";
import { createApiClient } from "../../lib/api-client.js";
import { output } from "../../lib/formatter.js";
import {
  handleCommandError,
  parseRequiredId,
  resolveOutputOptions,
  type DbCommandOptions,
} from "./common.js";

export async function handleDbSchemas(
  dbId: number,
  opts: DbCommandOptions,
): Promise<string[]> {
  const client = createApiClient(opts);
  return client.get(`/api/database/${dbId}/schemas`);
}

export function registerDbSchemasCommand(parent: Command): void {
  parent
    .command("schemas <db-id>")
    .description("List schemas in a database")
    .action(async (dbId: string, _localOpts, cmd) => {
      const opts = cmd.optsWithGlobals() as DbCommandOptions;
      try {
        const schemas = await handleDbSchemas(parseRequiredId(dbId, "Database ID"), opts);
        output(
          schemas.map((schema) => ({ schema })),
          resolveOutputOptions(opts),
        );
      } catch (error) {
        handleCommandError(error);
      }
    });
}
