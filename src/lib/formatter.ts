import Table from "cli-table3";
import { stringify } from "csv-stringify/sync";
import jmespath from "jmespath";
import type { PaginationInfo } from "../types/index.js";

export function formatQueryResult(
  rows: any[][],
  cols: { name: string }[]
): Record<string, any>[] {
  return rows.map((row) => {
    const obj: Record<string, any> = {};
    cols.forEach((col, i) => {
      obj[col.name] = row[i];
    });
    return obj;
  });
}

export function formatJson(data: any): string {
  return JSON.stringify(data, null, 2);
}

export function applyJsonFieldSelection(
  data: Record<string, any>[],
  fields: string
): Record<string, any>[] {
  const fieldList = fields.split(",").map((f) => f.trim());
  return data.map((row) => {
    const obj: Record<string, any> = {};
    for (const f of fieldList) {
      if (f in row) obj[f] = row[f];
    }
    return obj;
  });
}

export function applyJmesPath(data: any, expr: string): any {
  return jmespath.search(data, expr);
}

export function formatCsv(
  data: Record<string, any>[],
  omitHeader = false
): string {
  if (data.length === 0) return "";
  const columns = Object.keys(data[0]);
  const rows = data.map((row) => columns.map((c) => row[c]));
  return stringify(omitHeader ? rows : [columns, ...rows]);
}

export function formatTable(
  data: Record<string, any>[],
  omitHeader = false
): string {
  if (data.length === 0) return "(no results)";
  const columns = Object.keys(data[0]);
  const table = new Table(
    omitHeader ? {} : { head: columns }
  );
  for (const row of data) {
    table.push(columns.map((c) => String(row[c] ?? "")));
  }
  return table.toString();
}

export function formatPaginationInfo(info: PaginationInfo): string {
  if (info.total <= info.limit && info.offset === 0) {
    return "";
  }
  const start = info.offset + 1;
  const end = Math.min(info.offset + info.limit, info.total);
  const nextOffset = info.offset + info.limit;
  let msg = `// Showing rows ${start}-${end} of ${info.total} returned by Metabase.`;
  if (nextOffset < info.total) {
    msg += `\n// Use --offset ${nextOffset} to see next page.`;
  }
  return msg;
}

/**
 * Main output function: applies field selection, jq, format, and writes to stdout/stderr.
 */
export function output(
  data: Record<string, any>[],
  opts: {
    format?: "json" | "csv" | "table";
    json?: string;
    jq?: string;
    omitHeader?: boolean;
    pagination?: PaginationInfo;
  }
): void {
  let processed: any = data;

  // Apply --json field selection
  if (opts.json && Array.isArray(processed)) {
    processed = applyJsonFieldSelection(processed, opts.json);
  }

  // Apply --jq (JMESPath)
  if (opts.jq) {
    processed = applyJmesPath(processed, opts.jq);
    // After jq, always output as JSON regardless of format
    process.stdout.write(formatJson(processed) + "\n");
  } else {
    const format = opts.format || "json";
    switch (format) {
      case "csv":
        process.stdout.write(formatCsv(processed, opts.omitHeader));
        break;
      case "table":
        process.stdout.write(formatTable(processed, opts.omitHeader) + "\n");
        break;
      case "json":
      default:
        process.stdout.write(formatJson(processed) + "\n");
        break;
    }
  }

  // Pagination to stderr
  if (opts.pagination) {
    const paginationMsg = formatPaginationInfo(opts.pagination);
    if (paginationMsg) {
      process.stderr.write(paginationMsg + "\n");
    }
  }
}
