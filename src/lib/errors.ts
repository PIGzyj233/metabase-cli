import { resolveProfile } from "./auth.js";
import type { GlobalOptions } from "../types/index.js";

function resolveErrorPrefix(opts?: GlobalOptions): string {
  if (!opts) return "";
  try {
    const identity = resolveProfile(opts);
    return identity ? `[${identity.sourceId}] ` : "";
  } catch {
    return "";
  }
}

export function handleCommandError(error: unknown, opts?: GlobalOptions): void {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${resolveErrorPrefix(opts)}Error: ${message}\n`);
  process.exitCode = 1;
}
