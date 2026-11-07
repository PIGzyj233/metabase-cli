import Table from "cli-table3";
import { stringify } from "csv-stringify/sync";
import jmespath from "jmespath";
import type { PaginationInfo } from "../types/index.js";

function uniqueFieldNames(names: string[], reserved: string[] = []): string[] {
  // Keep original names available for their first occurrence. Generated suffixes
  // must not steal a later real column name (for example: id, id, id_2).
  const originalNames = new Set(names);
  const used = new Set(reserved);
  return names.map((name) => {
    let candidate = name;
    let suffix = 2;
    while (used.has(candidate)) {
      do {
        candidate = `${name}_${suffix++}`;
      } while (originalNames.has(candidate));
    }
    used.add(candidate);
    return candidate;
  });
}

export function formatQueryResult(
  rows: any[][],
  cols: { name: string }[]
): Record<string, any>[] {
  const names = uniqueFieldNames(cols.map((col) => col.name));
  // fromEntries defines own properties even for names such as __proto__.
  return rows.map((row) =>
    Object.fromEntries(names.map((name, i) => [name, row[i]])),
  );
}

export function formatJson(data: any): string {
  return JSON.stringify(data, null, 2);
}

export function withSourceAttribution(
  data: Record<string, any>[],
  sourceId: string
): Record<string, any>[] {
  if (sourceId.trim() === "") {
    throw new Error("Source attribution requires a non-empty source id.");
  }
  const fieldSet = new Set<string>();
  for (const row of data) {
    for (const field of Object.keys(row)) fieldSet.add(field);
  }
  const fields = [...fieldSet];
  const attributedNames = uniqueFieldNames(fields, ["_source"]);
  const names = new Map(fields.map((field, i) => [field, attributedNames[i]]));
  return data.map((row) => Object.fromEntries([
    ["_source", sourceId],
    ...Object.entries(row).map(([field, value]) => [names.get(field)!, value]),
  ]));
}

export function applyJsonFieldSelection(
  data: Record<string, any>[],
  fields: string
): Record<string, any>[] {
  const fieldList = fields.split(",").map((f) => f.trim());
  return data.map((row) => {
    const selected = Object.hasOwn(row, "_source")
      ? ["_source", ...fieldList.filter((field) => field !== "_source")]
      : fieldList;
    return Object.fromEntries(selected
      .filter((field) => Object.hasOwn(row, field))
      .map((field) => [field, row[field]]));
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
  if (info.total <= info.limit && info.offset === 0 && !info.truncated) {
    return "";
  }
  const start = info.offset < info.total ? info.offset + 1 : 0;
  const end = Math.min(info.offset + info.limit, info.total);
  const nextOffset = info.offset + info.limit;
  let msg = start === 0
    ? `// No rows at offset ${info.offset}; Metabase returned ${info.total} rows.`
    : `// Showing rows ${start}-${end} of ${info.total} returned by Metabase (local output slice).`;
  if (nextOffset < info.total) {
    msg += `\n// --offset ${nextOffset} selects the next slice by submitting the query again; results may change.`;
  }
  if (info.offset > 0) {
    msg += "\n// --offset slices this response locally; it does not resume a previous query.";
  }
  if (info.truncated) {
    msg += "\n// Metabase truncated the result; the returned row count is not the full query total. --offset cannot recover omitted rows.";
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
    sourceId?: string;
    sourceUrl?: string;
  }
): void {
  let processed: any = data;

  if (opts.sourceId && Array.isArray(processed)) {
    processed = withSourceAttribution(processed, opts.sourceId);
  }

  // Apply --json field selection
  if (opts.json && Array.isArray(processed)) {
    processed = applyJsonFieldSelection(processed, opts.json);
  }

  // Apply --jq (JMESPath)
  if (opts.jq) {
    processed = applyJmesPath(processed, opts.jq);
    // Explicit expressions own the result shape, including scalars or objects
    // without _source. Always output that result as JSON regardless of format.
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

  if (opts.sourceId && opts.sourceUrl) {
    process.stderr.write(`// Source: ${opts.sourceId} (${opts.sourceUrl})\n`);
  }

  // Pagination to stderr
  if (opts.pagination) {
    const paginationMsg = formatPaginationInfo(opts.pagination);
    if (paginationMsg) {
      process.stderr.write(paginationMsg + "\n");
    }
  }
}
