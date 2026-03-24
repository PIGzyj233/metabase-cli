import { Command } from "commander";
import { createApiClient } from "../../lib/api-client.js";
import { output } from "../../lib/formatter.js";
import { resolveFormat } from "../../lib/config.js";
import type { GlobalOptions } from "../../types/index.js";

export async function handleCardView(cardId: string | number, opts: GlobalOptions): Promise<any> {
  const client = createApiClient(opts);
  return client.get(`/api/card/${cardId}`);
}

export function registerCardViewCommand(parent: Command): void {
  parent
    .command("view <card-id>")
    .description("View card definition, query, and parameters")
    .action(async function (this: Command, cardId: string) {
      const opts = this.optsWithGlobals();
      const omitHeader = opts.omitHeader ?? opts.header === false;
      try {
        const card = await handleCardView(cardId, opts);
        // Show relevant fields for AI agents
        const params = (card.parameters || []).map((p: any) => ({
          slug: p.slug,
          name: p.name,
          type: p.type,
        }));
        const templateTags = Object.entries(
          card.dataset_query?.native?.["template-tags"] || {}
        ).map(([key, tag]: [string, any]) => ({
          name: key,
          display_name: tag["display-name"],
          type: tag.type,
          widget_type: tag["widget-type"] || null,
        }));
        const summary = [{
          id: card.id,
          name: card.name,
          description: card.description,
          query_type: card.dataset_query?.type,
          query: card.dataset_query?.native?.query || card.dataset_query,
          parameters: params,
          template_tags: templateTags,
        }];
        output(summary, {
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
