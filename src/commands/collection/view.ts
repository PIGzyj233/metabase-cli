import { Command } from "commander";
import { createApiClient } from "../../lib/api-client.js";
import { output } from "../../lib/formatter.js";
import { resolveFormat } from "../../lib/config.js";
import type { GlobalOptions } from "../../types/index.js";

export async function handleCollectionView(
  collectionId: number | string,
  opts: GlobalOptions
): Promise<any[]> {
  const client = createApiClient(opts);
  const res = await client.get(`/api/collection/${collectionId}/items`);
  return res.data || res;
}

export function registerCollectionViewCommand(parent: Command): void {
  parent
    .command("view <collection-id>")
    .description("View collection contents")
    .action(async function (this: Command, collectionId: string) {
      const opts = this.optsWithGlobals();
      const omitHeader = opts.omitHeader ?? opts.header === false;
      try {
        const items = await handleCollectionView(collectionId, opts);
        const simplified = items.map((i: any) => ({
          id: i.id,
          name: i.name,
          model: i.model,
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
