import { Command } from "commander";
import { createApiClient } from "../../lib/api-client.js";
import { projectCardDetail } from "../../lib/agent-projections.js";
import { output } from "../../lib/formatter.js";
import { resolveCommandOutputOptions } from "../../lib/output-options.js";
import { handleCommandError } from "../../lib/errors.js";
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
      try {
        const card = await handleCardView(cardId, opts);
        output([card], resolveCommandOutputOptions(opts));
      } catch (e: any) {
        handleCommandError(e, opts);
      }
    });
}
