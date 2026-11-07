import { output } from "./formatter.js";
import { resolveFormat } from "./config.js";
import type { GlobalOptions } from "../types/index.js";

export interface OperationResult {
  record: { operation: string; ok: boolean; [field: string]: unknown };
  sourceId: string;
  sourceUrl?: string;
}

// Use the operation's captured source, including after the Profile was removed.
export function outputOperationResult(result: OperationResult, opts: GlobalOptions): void {
  output([result.record], {
    format: resolveFormat(opts), json: opts.json, jq: opts.jq,
    omitHeader: opts.omitHeader ?? opts.header === false,
    sourceId: result.sourceId, sourceUrl: result.sourceUrl,
  });
}
