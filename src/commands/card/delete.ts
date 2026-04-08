import { Command } from "commander";
import { createApiClient } from "../../lib/api-client.js";
import type { GlobalOptions } from "../../types/index.js";
import { parseRequiredId, handleCommandError } from "../db/common.js";
import { handleCardUpdate } from "./update.js";

interface CardDeleteOptions extends GlobalOptions {
  hardDelete?: boolean;
}

export async function handleCardDelete(
  cardId: string | number,
  opts: CardDeleteOptions
): Promise<{ mode: "archived" | "deleted"; id: number }> {
  const parsedCardId = parseRequiredId(String(cardId), "Card ID");

  if (opts.hardDelete) {
    const client = createApiClient(opts);
    await client.delete(`/api/card/${parsedCardId}`);
    return { mode: "deleted", id: parsedCardId };
  }

  const { hardDelete: _hardDelete, ...updateOpts } = opts;
  await handleCardUpdate(parsedCardId, { ...updateOpts, archived: true });
  return { mode: "archived", id: parsedCardId };
}

export function registerCardDeleteCommand(parent: Command): void {
  parent
    .command("delete <card-id>")
    .description("Delete a saved card/question")
    .option("--hard-delete", "Permanently delete instead of archiving")
    .action(async function (this: Command, cardId: string) {
      const opts = this.optsWithGlobals() as CardDeleteOptions;
      try {
        const result = await handleCardDelete(cardId, opts);
        if (result.mode === "archived") {
          process.stderr.write(`Archived card ${result.id}.\n`);
        } else {
          process.stderr.write(`Deleted card ${result.id} permanently.\n`);
        }
      } catch (error) {
        handleCommandError(error);
      }
    });
}
