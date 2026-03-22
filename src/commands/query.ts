import { Command } from "commander";
import { createApiClient } from "../lib/api-client.js";
import { formatQueryResult, output } from "../lib/formatter.js";
import { resolveDefaultDb, resolveFormat } from "../lib/config.js";
import type { GlobalOptions, PaginationInfo } from "../types/index.js";

interface QueryOptions extends GlobalOptions {
  db?: number;
  limit?: number;
  offset?: number;
}

interface QueryHandleResult {
  data: Record<string, any>[];
  pagination: PaginationInfo;
}

export async function handleQuery(
  sql: string,
  opts: QueryOptions
): Promise<QueryHandleResult> {
  const dbId = opts.db || resolveDefaultDb(opts);
  if (!dbId) {
    throw new Error("Database ID required. Use --db <id> or set MB_DEFAULT_DB.");
  }

  const client = createApiClient(opts);
  const res = await client.post("/api/dataset", {
    database: dbId,
    type: "native",
    native: { query: sql },
  });

  if (res.status === "failed" || res.error) {
    throw new Error(res.error || res.json_query?.error || "Query execution failed");
  }

  const rows = res.data?.rows || [];
  const cols = res.data?.cols || [];
  const allData = formatQueryResult(rows, cols);

  // Client-side pagination
  const limit = opts.limit ?? 100;
  const offset = opts.offset ?? 0;
  const paginatedData = allData.slice(offset, offset + limit);

  return {
    data: paginatedData,
    pagination: {
      total: allData.length,
      offset,
      limit,
    },
  };
}

export function registerQueryCommand(program: Command): void {
  program
    .command("query <sql>")
    .description("Execute a native SQL query")
    .option("--db <id>", "Database ID (or set MB_DEFAULT_DB)", (v) => parseInt(v))
    .option("--limit <n>", "Max rows to return (default: 100)", (v) => parseInt(v), 100)
    .option("--offset <n>", "Row offset for pagination", (v) => parseInt(v), 0)
    .action(async function (this: Command, sql: string) {
      const opts = this.optsWithGlobals();
      const omitHeader = opts.omitHeader ?? opts.header === false;
      try {
        const result = await handleQuery(sql, opts);
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
