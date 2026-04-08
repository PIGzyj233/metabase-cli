import type { GlobalOptions } from "../../types/index.js";
export { handleCommandError } from "../../lib/errors.js";

export interface DbCommandOptions extends GlobalOptions {
  header?: boolean;
}

export interface DbTablesOptions extends DbCommandOptions {
  schema?: string;
}

export function parseRequiredId(raw: string, label: string): number {
  if (!/^[1-9]\d*$/.test(raw)) {
    throw new Error(`${label} must be a positive integer.`);
  }
  return Number(raw);
}

export function resolveOutputOptions(opts: DbCommandOptions) {
  return {
    format: opts.format,
    json: opts.json,
    jq: opts.jq,
    omitHeader: opts.omitHeader ?? opts.header === false,
  };
}
