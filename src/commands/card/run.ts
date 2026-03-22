import { Command } from "commander";
import { createApiClient } from "../../lib/api-client.js";
import { formatQueryResult, output } from "../../lib/formatter.js";
import { resolveFormat } from "../../lib/config.js";
import type { GlobalOptions, PaginationInfo } from "../../types/index.js";

interface CardRunOptions extends GlobalOptions {
  params?: string;
  limit?: number;
  offset?: number;
}

interface CardRunResult {
  data: Record<string, any>[];
  pagination: PaginationInfo;
}

async function resolveParameters(
  client: ReturnType<typeof createApiClient>,
  cardId: string | number,
  paramsJson: string
): Promise<any[]> {
  const userParams = JSON.parse(paramsJson);
  const card = await client.get(`/api/card/${cardId}`);
  const cardParams: any[] = card.parameters || [];

  const resolved: any[] = [];
  for (const [key, value] of Object.entries(userParams)) {
    const match = cardParams.find(
      (p: any) => p.slug === key || p.name === key
    );
    if (!match) {
      const available = cardParams.map((p: any) => p.slug || p.name).join(", ");
      throw new Error(
        `Unknown parameter "${key}". Available parameters: ${available || "(none)"}`
      );
    }
    resolved.push({
      id: match.id,
      type: match.type,
      target: match.target,
      value,
    });
  }

  return resolved;
}

export async function handleCardRun(
  cardId: string | number,
  opts: CardRunOptions
): Promise<CardRunResult> {
  const client = createApiClient(opts);

  let body: any = { ignore_cache: false };
  if (opts.params) {
    body.parameters = await resolveParameters(client, cardId, opts.params);
  }

  const res = await client.post(`/api/card/${cardId}/query`, body);

  if (res.status === "failed" || res.error) {
    throw new Error(res.error || "Card query execution failed");
  }

  const rows = res.data?.rows || [];
  const cols = res.data?.cols || [];
  const allData = formatQueryResult(rows, cols);

  const limit = opts.limit ?? 100;
  const offset = opts.offset ?? 0;
  const paginatedData = allData.slice(offset, offset + limit);

  return {
    data: paginatedData,
    pagination: { total: allData.length, offset, limit },
  };
}

export function registerCardRunCommand(parent: Command): void {
  parent
    .command("run <card-id>")
    .description("Execute a saved card/question")
    .option("--params <json>", "Parameters as JSON key-value pairs")
    .option("--limit <n>", "Max rows (default: 100)", (v) => parseInt(v), 100)
    .option("--offset <n>", "Row offset", (v) => parseInt(v), 0)
    .action(async function (this: Command, cardId: string) {
      const opts = this.optsWithGlobals();
      const omitHeader = opts.omitHeader ?? opts.header === false;
      try {
        const result = await handleCardRun(cardId, opts);
        output(result.data, {
          format: resolveFormat(opts),
          json: opts.json,
          jq: opts.jq,
          omitHeader,
          pagination: result.pagination,
        });
      } catch (e: any) {
        process.stderr.write(`Error: ${e.message}\n`);
        process.exitCode = 1;
      }
    });
}
