import { Command } from "commander";
import { readJsonInput, resolveSqlInput } from "../../lib/input-source.js";
import { createApiClient } from "../../lib/api-client.js";
import { output } from "../../lib/formatter.js";
import type { CardUpdateOptions } from "../../types/index.js";
import {
  parseRequiredId,
  resolveOutputOptions,
  handleCommandError,
} from "../db/common.js";

const MUTABLE_CARD_KEYS = [
  "name",
  "description",
  "dataset_query",
  "display",
  "visualization_settings",
  "collection_id",
  "archived",
  "type",
  "parameters",
  "parameter_mappings",
  "result_metadata",
  "cache_ttl",
  "enable_embedding",
  "embedding_type",
  "embedding_params",
  "dashboard_id",
  "dashboard_tab_id",
  "collection_position",
  "collection_preview",
] as const;

function parseOptionalCollectionId(raw: string): number | string {
  if (/^[1-9]\d*$/.test(raw)) {
    return Number(raw);
  }
  if (/^[A-Za-z0-9_-]{21}$/.test(raw)) {
    return raw;
  }
  throw new Error("Collection ID must be a positive integer or a 21-character NanoID.");
}

function buildMutableCardBody(card: Record<string, any>): Record<string, any> {
  const body: Record<string, any> = {};

  for (const key of MUTABLE_CARD_KEYS) {
    if (Object.prototype.hasOwnProperty.call(card, key)) {
      body[key] = card[key];
    }
  }

  return body;
}

function hasInlinePatch(opts: CardUpdateOptions): boolean {
  return (
    opts.name !== undefined ||
    opts.description !== undefined ||
    opts.collection !== undefined ||
    opts.archived === true ||
    opts.sql !== undefined ||
    opts.sqlFile !== undefined
  );
}

function validateRequiredCardFields(body: Record<string, any>): void {
  if (
    body.name == null ||
    body.dataset_query == null ||
    body.display == null ||
    body.visualization_settings == null
  ) {
    throw new Error("Updated card body is missing required Metabase fields.");
  }
}

export async function handleCardUpdate(
  cardId: string | number,
  opts: CardUpdateOptions
): Promise<any> {
  const parsedCardId = parseRequiredId(String(cardId), "Card ID");
  if (opts.from !== undefined && hasInlinePatch(opts)) {
    throw new Error("--from cannot be combined with inline update flags.");
  }
  if (opts.from === undefined && !hasInlinePatch(opts)) {
    throw new Error("Update requires at least one patch flag or --from <file>.");
  }

  // Read and validate local input before fetching the current card.
  const patch = opts.from === undefined ? undefined : await readJsonInput(opts.from, "Card update JSON patch");
  const sql = opts.sql !== undefined || opts.sqlFile !== undefined
    ? await resolveSqlInput(opts.sql, opts.sqlFile, "--sql-file") : undefined;
  const collectionId = opts.collection === undefined ? undefined : parseOptionalCollectionId(opts.collection);
  const client = createApiClient(opts);
  const currentCard = await client.get(`/api/card/${parsedCardId}`);
  const body = buildMutableCardBody(currentCard);

  if (patch !== undefined) {
    Object.assign(body, patch);
  } else {
    if (opts.name !== undefined) {
      body.name = opts.name;
    }
    if (opts.description !== undefined) {
      body.description = opts.description;
    }
    if (opts.collection !== undefined) {
      body.collection_id = collectionId;
    }
    if (opts.archived === true) {
      body.archived = true;
    }
    if (sql !== undefined) {
      if (currentCard.dataset_query?.type !== "native") {
        throw new Error(
          "--sql and --sql-file updates only support native-query cards. Use --from for non-native cards."
        );
      }
      const datasetQuery = JSON.parse(JSON.stringify(body.dataset_query));
      datasetQuery.native = {
        ...(datasetQuery.native ?? {}),
        query: sql,
      };
      body.dataset_query = datasetQuery;
    }
  }

  validateRequiredCardFields(body);
  return await client.put(`/api/card/${parsedCardId}`, body);
}

export function registerCardUpdateCommand(parent: Command): void {
  parent
    .command("update <card-id>")
    .description("Update a saved card/question")
    .option("--name <name>", "Card name")
    .option("--description <text>", "Card description")
    .option("--collection <id>", "Collection ID or NanoID")
    .option("--archived", "Archive the card")
    .option("--sql <sql>", "Native SQL query text for native-query cards")
    .option("--sql-file <path>", "Read native SQL from a UTF-8 file, or - for stdin")
    .option("--from <file>", "Read update patch from JSON file, or - for stdin")
    .action(async function (this: Command, cardId: string) {
      const opts = this.optsWithGlobals() as CardUpdateOptions;
      try {
        const updatedCard = await handleCardUpdate(cardId, opts);
        output([updatedCard], resolveOutputOptions(opts));
      } catch (error) {
        handleCommandError(error, opts);
      }
    });
}
