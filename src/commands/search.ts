import { Command } from "commander";
import { createApiClient } from "../lib/api-client.js";
import { output } from "../lib/formatter.js";
import { resolveFormat } from "../lib/config.js";
import type { GlobalOptions } from "../types/index.js";

export async function handleSearch(
  query: string,
  opts: GlobalOptions & { type?: string }
): Promise<any[]> {
  const client = createApiClient(opts);
  const params: Record<string, string> = { q: query };
  if (opts.type) {
    params.models = opts.type;
  }
  const res = await client.get("/api/search", params);
  let results = res.data || res;

  // Client-side filter as fallback — Metabase API may return extra types
  if (opts.type) {
    results = results.filter((r: any) => r.model === opts.type);
  }

  return results;
}

export function registerSearchCommand(program: Command): void {
  program
    .command("search <query>")
    .description("Search cards, dashboards, collections, and tables")
    .option("--type <type>", "Filter: card, dashboard, collection, table")
    .action(async function (this: Command, query: string) {
      const opts = this.optsWithGlobals();
      const omitHeader = opts.omitHeader ?? opts.header === false;
      try {
        const results = await handleSearch(query, opts);
        const simplified = results.map((r: any) => ({
          id: r.id,
          name: r.name,
          model: r.model,
          collection_id: r.collection_id,
        }));
        output(simplified, {
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
