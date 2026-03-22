import { Command } from "commander";
import { createApiClient } from "../../lib/api-client.js";
import { output } from "../../lib/formatter.js";
import { resolveFormat } from "../../lib/config.js";
import type { GlobalOptions } from "../../types/index.js";

export async function handleCollectionList(
  opts: GlobalOptions & { parent?: number }
): Promise<any[]> {
  const client = createApiClient(opts);
  const collections = await client.get("/api/collection");

  if (opts.parent) {
    return collections.filter(
      (c: any) => c.location === `/${opts.parent}/` || c.parent_id === opts.parent
    );
  }
  return collections;
}

export function registerCollectionListCommand(parent: Command): void {
  parent
    .command("list")
    .description("List collections")
    .option("--parent <id>", "Filter by parent collection", (v) => parseInt(v))
    .action(async function (this: Command) {
      const opts = this.optsWithGlobals();
      const omitHeader = opts.omitHeader ?? opts.header === false;
      try {
        const collections = await handleCollectionList(opts);
        const simplified = collections.map((c: any) => ({
          id: c.id,
          name: c.name,
          location: c.location,
        }));
        output(simplified, {
          format: resolveFormat(opts),
          json: opts.json,
          jq: opts.jq,
          omitHeader,
        });
      } catch (e: any) {
        process.stderr.write(`Error: ${e.message}\n`);
        process.exitCode = 1;
      }
    });
}
