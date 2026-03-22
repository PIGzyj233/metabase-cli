import type { GlobalOptions } from "../../types/index.js";

export interface DbCommandOptions extends GlobalOptions {
  header?: boolean;
}

export interface DbTablesOptions extends DbCommandOptions {
  schema?: string;
}

export function parseRequiredId(raw: string, label: string): number {
  const value = Number.parseInt(raw, 10);
  if (Number.isNaN(value) || value <= 0) {
    throw new Error(`${label} must be a positive integer.`);
  }
  return value;
}

export function resolveOutputOptions(opts: DbCommandOptions) {
  return {
    format: opts.format,
    json: opts.json,
    jq: opts.jq,
    omitHeader: opts.omitHeader ?? opts.header === false,
  };
}

export function handleCommandError(error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`Error: ${message}\n`);
  process.exitCode = 1;
}
