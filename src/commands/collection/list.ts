import { Command } from "commander";
import { createApiClient } from "../../lib/api-client.js";
import { projectCollectionSummary } from "../../lib/agent-projections.js";
import { output } from "../../lib/formatter.js";
import { resolveCommandOutputOptions } from "../../lib/output-options.js";
import { handleCommandError } from "../../lib/errors.js";
import type { GlobalOptions } from "../../types/index.js";

export async function handleCollectionList(
  opts: GlobalOptions & { parent?: number }
): Promise<any[]> {
  const client = createApiClient(opts);
  const collections = await client.get("/api/collection");

  if (opts.parent) {
    return collections.filter(
      (c: any) => c.location === `/${opts.parent}/` || c.parent_id === opts.parent
    ).map(projectCollectionSummary);
  }
  return collections.map(projectCollectionSummary);
}

export function registerCollectionListCommand(parent: Command): void {
  parent
    .command("list")
    .description("List collections")
    .option("--parent <id>", "Filter by parent collection", (v) => parseInt(v))
    .action(async function (this: Command) {
      const opts = this.optsWithGlobals();
      try {
        const collections = await handleCollectionList(opts);
        output(collections, resolveCommandOutputOptions(opts));
      } catch (e: any) {
        handleCommandError(e, opts);
      }
    });
}
