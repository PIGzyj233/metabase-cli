import { Command } from "commander";
import { parsePositiveInteger, parseNonNegativeInteger, validatePagination } from "../lib/input-validation.js";
import { resolveSqlInput } from "../lib/input-source.js";
import { createApiClient } from "../lib/api-client.js";
import { output } from "../lib/formatter.js";
import { unpackDatasetResult, type DatasetResult } from "../lib/dataset-result.js";
import { resolveDefaultDb } from "../lib/config.js";
import { resolveCommandOutputOptions } from "../lib/output-options.js";
import { handleCommandError } from "../lib/errors.js";
import type { GlobalOptions } from "../types/index.js";

interface QueryOptions extends GlobalOptions {
  file?: string;
  db?: number;
  limit?: number;
  offset?: number;
}

export async function handleQuery(
  sql: string | undefined,
  opts: QueryOptions
): Promise<DatasetResult> {
  validatePagination(opts);
  const query = await resolveSqlInput(sql, opts.file, "--file");
  const rawDbId = opts.db ?? resolveDefaultDb(opts);
  if (rawDbId === undefined) {
    throw new Error("Database ID required. Use --db <id> or set MB_DEFAULT_DB.");
  }

  const dbId = parsePositiveInteger(rawDbId, "Database ID");
  const client = createApiClient(opts);
  const res = await client.post("/api/dataset", {
    database: dbId,
    type: "native",
    native: { query },
  });

  return unpackDatasetResult(res, {
    limit: opts.limit,
    offset: opts.offset,
    failureMessage: "Query execution failed",
  });
}

export function registerQueryCommand(program: Command): void {
  program
    .command("query [sql]")
    .description("Execute a native SQL query")
    .option("--file <path>", "Read UTF-8 SQL from a file, or - for stdin")
    .option("--db <id>", "Database ID (or set MB_DEFAULT_DB)", (v) => parsePositiveInteger(v, "Database ID"))
    .option("--limit <n>", "Max rows to display from the response (local slice)", (v) => parsePositiveInteger(v, "Limit"), 100)
    .option("--offset <n>", "Rows to skip locally; each invocation submits the query again", (v) => parseNonNegativeInteger(v, "Offset"), 0)
    .action(async function (this: Command, sql: string | undefined) {
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
