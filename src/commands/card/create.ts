import { readFileSync } from "node:fs";
import { Command } from "commander";
import { createApiClient } from "../../lib/api-client.js";
import { output } from "../../lib/formatter.js";
import type { CardCreateOptions } from "../../types/index.js";
import {
  parseRequiredId,
  resolveOutputOptions,
  handleCommandError,
} from "../db/common.js";

function parseOptionalCollectionId(raw: string): number | string {
  if (/^[1-9]\d*$/.test(raw)) {
    return Number(raw);
  }
  if (/^[A-Za-z0-9_-]{21}$/.test(raw)) {
    return raw;
  }
  throw new Error("Collection ID must be a positive integer or a 21-character NanoID.");
}

function readCreateBodyFromFile(filePath: string): Record<string, any> {
  let raw: string;
  try {
    raw = readFileSync(filePath, "utf8");
  } catch {
    throw new Error(`Unable to read create payload file: ${filePath}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`Create payload file must contain valid JSON: ${filePath}`);
  }

  if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") {
    throw new Error("Card create JSON payload must be an object.");
  }

  return parsed as Record<string, any>;
}

export async function handleCardCreate(opts: CardCreateOptions): Promise<any> {
  const inlineFlags: Array<keyof CardCreateOptions> = [
    "name",
    "database",
    "sql",
    "display",
    "collection",
    "description",
    "type",
  ];

  let body: Record<string, any>;
  if (opts.from !== undefined) {
    if (inlineFlags.some((flag) => opts[flag] !== undefined)) {
      throw new Error("--from cannot be combined with inline create flags.");
    }
    body = readCreateBodyFromFile(opts.from);
  } else {
    if (!opts.name || !opts.database || !opts.sql) {
      throw new Error("Inline mode requires --name, --database, and --sql.");
    }

    const databaseId = parseRequiredId(opts.database, "Database ID");
    body = {
      name: opts.name,
      display: opts.display ?? "table",
      type: opts.type ?? "question",
      visualization_settings: {},
      dataset_query: {
        type: "native",
        database: databaseId,
        native: {
          query: opts.sql,
        },
      },
    };

    if (opts.description !== undefined) {
      body.description = opts.description;
    }
    if (opts.collection !== undefined) {
      body.collection_id = parseOptionalCollectionId(opts.collection);
    }
  }

  const client = createApiClient(opts);
  return await client.post("/api/card", body);
}

export function registerCardCreateCommand(parent: Command): void {
  parent
    .command("create")
    .description("Create a saved card/question")
    .option("--name <name>", "Card name")
    .option("--database <id>", "Database ID for inline native SQL mode")
    .option("--sql <sql>", "Native SQL query text for inline mode")
    .option("--display <type>", "Card display type")
    .option("--collection <id>", "Collection ID or NanoID")
    .option("--description <text>", "Card description")
    .option("--type <type>", "Card type")
    .option("--from <file>", "Read full create payload from JSON file")
    .action(async function (this: Command) {
      const opts = this.optsWithGlobals() as CardCreateOptions;
      try {
        const createdCard = await handleCardCreate(opts);
        output([createdCard], resolveOutputOptions(opts));
      } catch (error) {
        handleCommandError(error);
      }
    });
}
