import { Command } from "commander";
import { createApiClient } from "../../lib/api-client.js";
import { formatJson } from "../../lib/formatter.js";
import type { GlobalOptions } from "../../types/index.js";

export async function handleCardView(cardId: number, opts: GlobalOptions): Promise<any> {
  const client = createApiClient(opts);
  return client.get(`/api/card/${cardId}`);
}

export function registerCardViewCommand(parent: Command): void {
  parent
    .command("view <card-id>")
    .description("View card definition, query, and parameters")
    .action(async function (this: Command, cardId: string) {
      const opts = this.optsWithGlobals();
      try {
        const card = await handleCardView(parseInt(cardId), opts);
        // Show relevant fields for AI agents
        const summary = {
          id: card.id,
          name: card.name,
          description: card.description,
          query_type: card.dataset_query?.type,
          query: card.dataset_query?.native?.query || card.dataset_query,
          parameters: (card.parameters || []).map((p: any) => ({
            slug: p.slug,
            name: p.name,
            type: p.type,
          })),
        };
        process.stdout.write(formatJson(summary) + "\n");
      } catch (e: any) {
        process.stderr.write(`Error: ${e.message}\n`);
        process.exit(1);
      }
    });
}
