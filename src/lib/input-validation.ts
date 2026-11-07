import { InvalidArgumentError } from "commander";

function parseInteger(raw: string | number, label: string, allowZero: boolean): number {
  const pattern = allowZero ? /^(?:0|[1-9]\d*)$/ : /^[1-9]\d*$/;
  const value = typeof raw === "number" ? raw : Number(raw);
  if (
    (typeof raw === "string" && !pattern.test(raw)) ||
    !Number.isInteger(value) || value < (allowZero ? 0 : 1)
  ) {
    throw new InvalidArgumentError(
      `${label} must be a ${allowZero ? "non-negative" : "positive"} integer.`,
    );
  }
  if (!Number.isSafeInteger(value)) {
    throw new InvalidArgumentError(`${label} must not exceed ${Number.MAX_SAFE_INTEGER}.`);
  }
  return value;
}

export function parsePositiveInteger(raw: string | number, label: string): number {
  return parseInteger(raw, label, false);
}

export function parseNonNegativeInteger(raw: string | number, label: string): number {
  return parseInteger(raw, label, true);
}

export function validatePagination(options: { limit?: number; offset?: number }): void {
  if (options.limit !== undefined) parsePositiveInteger(options.limit, "Limit");
  if (options.offset !== undefined) parseNonNegativeInteger(options.offset, "Offset");
}
