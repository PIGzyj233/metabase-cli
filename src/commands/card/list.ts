import { Command } from "commander";
import { createApiClient } from "../../lib/api-client.js";
import { projectCardSummary } from "../../lib/agent-projections.js";
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
    return (res.data || res).map(projectCardSummary);
  }

  const cards = await client.get("/api/card");
  return cards.map(projectCardSummary);
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
        output(cards, {
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
