import { Command } from "commander";
import { createApiClient } from "../../lib/api-client.js";
import { formatJson } from "../../lib/formatter.js";
import {
  handleCommandError,
  parseRequiredId,
  type DbCommandOptions,
} from "./common.js";

export async function handleDbMetadata(
  dbId: number,
  opts: DbCommandOptions,
): Promise<any> {
  const client = createApiClient(opts);
  return client.get(`/api/database/${dbId}/metadata`);
}

export function registerDbMetadataCommand(parent: Command): void {
  parent
    .command("metadata <db-id>")
    .description("Full database metadata dump")
    .action(async (dbId: string, _localOpts, cmd) => {
      const opts = cmd.optsWithGlobals() as DbCommandOptions;
      try {
        const metadata = await handleDbMetadata(parseRequiredId(dbId, "Database ID"), opts);
        process.stdout.write(formatJson(metadata) + "\n");
      } catch (error) {
        handleCommandError(error);
      }
    });
}
