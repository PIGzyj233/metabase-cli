import { Command } from "commander";
import { createApiClient } from "../../lib/api-client.js";
import { projectSchema } from "../../lib/agent-projections.js";
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
): Promise<any[]> {
  const client = createApiClient(opts);
  const schemas = await client.get(`/api/database/${dbId}/schemas`);
  return schemas.map(projectSchema);
}

export function registerDbSchemasCommand(parent: Command): void {
  parent
    .command("schemas <db-id>")
    .description("List schemas in a database")
    .action(async (dbId: string, _localOpts, cmd) => {
      const opts = cmd.optsWithGlobals() as DbCommandOptions;
      try {
        const schemas = await handleDbSchemas(parseRequiredId(dbId, "Database ID"), opts);
        output(schemas, resolveOutputOptions(opts));
      } catch (error) {
        handleCommandError(error);
      }
    });
}
