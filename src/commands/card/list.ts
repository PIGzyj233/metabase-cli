import { Command } from "commander";
import { createApiClient } from "../../lib/api-client.js";
import { output } from "../../lib/formatter.js";
import { resolveFormat } from "../../lib/config.js";
import type { GlobalOptions } from "../../types/index.js";

export async function handleCardList(
  opts: GlobalOptions & { collection?: string | number }
): Promise<any[]> {
  const client = createApiClient(opts);

  if (opts.collection) {
    // Use collection items endpoint filtered to cards
    const res = await client.get(
      `/api/collection/${opts.collection}/items`,
      { models: "card" }
    );
    return res.data || res;
  }

  return client.get("/api/card");
}

export function registerCardListCommand(parent: Command): void {
  parent
    .command("list")
    .description("List saved cards/questions")
    .option("--collection <id>", "Filter by collection")
    .action(async function (this: Command) {
      const opts = this.optsWithGlobals();
      const omitHeader = opts.omitHeader ?? opts.header === false;
      try {
        const cards = await handleCardList(opts);
        const simplified = cards.map((c: any) => ({
          id: c.id,
          name: c.name,
          collection_id: c.collection_id,
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
