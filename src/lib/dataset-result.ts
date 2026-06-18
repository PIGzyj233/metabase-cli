import type { PaginationInfo } from "../types/index.js";
import { formatQueryResult } from "./formatter.js";

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
    throw new Error(raw.error || raw.json_query?.error || options.failureMessage);
  }

  const rows = raw.data?.rows || [];
  const cols = raw.data?.cols || [];
  const allData = formatQueryResult(rows, cols);
  const limit = options.limit ?? 100;
  const offset = options.offset ?? 0;

  return {
    data: allData.slice(offset, offset + limit),
    pagination: {
      total: allData.length,
      offset,
      limit,
    },
  };
}
