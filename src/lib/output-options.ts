import { resolveProfile } from "./auth.js";
import { resolveFormat } from "./config.js";
import type { PaginationInfo } from "../types/index.js";
import type { GlobalOptions } from "../types/index.js";

export function resolveCommandOutputOptions(
  opts: GlobalOptions & { header?: boolean },
  extra: { pagination?: PaginationInfo } = {}
) {
  const identity = resolveProfile(opts);
  return {
    format: resolveFormat(opts),
    json: opts.json,
    jq: opts.jq,
    omitHeader: opts.omitHeader ?? opts.header === false,
    sourceId: identity?.sourceId,
    sourceUrl: identity?.baseUrl,
    ...extra,
  };
}
