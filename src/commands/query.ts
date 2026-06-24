import { Command } from "commander";
import { createApiClient } from "../lib/api-client.js";
import { output } from "../lib/formatter.js";
import { unpackDatasetResult, type DatasetResult } from "../lib/dataset-result.js";
import { resolveDefaultDb } from "../lib/config.js";
import { resolveCommandOutputOptions } from "../lib/output-options.js";
import { handleCommandError } from "../lib/errors.js";
import type { GlobalOptions } from "../types/index.js";

interface QueryOptions extends GlobalOptions {
  db?: number;
  limit?: number;
  offset?: number;
}

export async function handleQuery(
  sql: string,
  opts: QueryOptions
): Promise<DatasetResult> {
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

  return unpackDatasetResult(res, {
    limit: opts.limit,
    offset: opts.offset,
    failureMessage: "Query execution failed",
  });
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
      try {
        const result = await handleQuery(sql, opts);
        output(result.data, resolveCommandOutputOptions(opts, {
          pagination: result.pagination,
        }));
      } catch (e: any) {
        handleCommandError(e, opts);
      }
    });
}
