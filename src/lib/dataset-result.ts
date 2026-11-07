import type { PaginationInfo } from "../types/index.js";
import { formatQueryResult } from "./formatter.js";
import { CliError } from "./cli-error.js";
import { humanizeQueryError } from "./error-message.js";

export interface DatasetResultOptions {
  limit?: number;
  offset?: number;
  failureMessage: string;
}

export interface DatasetResult {
  data: Record<string, any>[];
  pagination: PaginationInfo;
}

export function unpackDatasetResult(
  raw: any,
  options: DatasetResultOptions,
): DatasetResult {
  if (raw.status === "failed" || raw.error) {
    throw new CliError(
      "QUERY_FAILED",
      humanizeQueryError(raw.error || raw.json_query?.error || options.failureMessage),
      "Review SQL, parameters, and database permissions before retrying.",
    );
  }

  const rows = raw.data?.rows || [];
  const cols = raw.data?.cols || [];
  const limit = options.limit ?? 100;
  const offset = options.offset ?? 0;
  const truncated = raw.data?.rows_truncated;

  return {
    data: formatQueryResult(rows.slice(offset, offset + limit), cols),
    pagination: {
      total: rows.length,
      offset,
      limit,
      ...((truncated === true || (typeof truncated === "number" && truncated > 0))
        ? { truncated: true }
        : {}),
    },
  };
}
