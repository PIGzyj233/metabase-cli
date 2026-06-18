import { Command } from "commander";
import { createApiClient } from "../../lib/api-client.js";
import { projectCardDetail } from "../../lib/agent-projections.js";
import { output } from "../../lib/formatter.js";
import { resolveFormat } from "../../lib/config.js";
import type { GlobalOptions } from "../../types/index.js";

export async function handleCardView(cardId: string | number, opts: GlobalOptions): Promise<any> {
  const client = createApiClient(opts);
  const card = await client.get(`/api/card/${cardId}`);
  return projectCardDetail(card);
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
        output([card], {
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
