import { parsePositiveInteger } from "../../lib/input-validation.js";
import type { GlobalOptions } from "../../types/index.js";
import { resolveCommandOutputOptions } from "../../lib/output-options.js";
export { handleCommandError } from "../../lib/errors.js";

export interface DbCommandOptions extends GlobalOptions {
  header?: boolean;
}

export interface DbTablesOptions extends DbCommandOptions {
  schema?: string;
}

export function parseRequiredId(raw: string, label: string): number {
  return parsePositiveInteger(raw, label);
}

export function resolveOutputOptions(opts: DbCommandOptions) {
  return resolveCommandOutputOptions(opts);
}
