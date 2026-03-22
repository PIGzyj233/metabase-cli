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
  return res.data || res;
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
        process.exit(1);
      }
    });
}
