import { Command } from "commander";
import type { GlobalOptions } from "../../types/index.js";
import { parseRequiredId, handleCommandError } from "../db/common.js";
import { handleCardUpdate } from "./update.js";

export async function handleCardArchive(
  cardId: string | number,
  opts: GlobalOptions
): Promise<{ mode: "archived"; id: number }> {
  const parsedCardId = parseRequiredId(String(cardId), "Card ID");
  await handleCardUpdate(parsedCardId, { ...opts, archived: true });
  return { mode: "archived", id: parsedCardId };
}

export function registerCardArchiveCommand(parent: Command): void {
  parent
    .command("archive <card-id>")
    .description("Archive a saved card/question")
    .action(async function (this: Command, cardId: string) {
      const opts = this.optsWithGlobals() as GlobalOptions;
      try {
        const result = await handleCardArchive(cardId, opts);
        process.stderr.write(`Archived card ${result.id}.\n`);
      } catch (error) {
        handleCommandError(error);
      }
    });
}
