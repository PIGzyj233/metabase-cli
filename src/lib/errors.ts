import { resolveInvocationProfile } from "./auth.js";
import type { GlobalOptions } from "../types/index.js";

export interface StructuredError {
  code: string;
  message: string;
  http_status?: number;
  retryable: boolean;
  hint: string;
  source?: string;
}

export interface ErrorContext {
  sourceId?: string;
  resolveSource?: boolean;
}

type ErrorOptions = GlobalOptions & { password?: string };

function errorContext(opts?: ErrorOptions, context: ErrorContext = {}) {
  let source = context.sourceId;
  const secrets = [opts?.token, opts?.password, process.env.MB_TOKEN,
    process.env.MB_SESSION_TOKEN, process.env.MB_PASSWORD];
  if (opts && context.resolveSource !== false) {
    try {
      const identity = resolveInvocationProfile(opts);
      source ??= identity?.sourceId;
      secrets.push(identity?.tokenInfo.token);
    } catch {
      // Identity errors must not hide the original failure.
    }
  }
  const redact = (value: string) => {
    let result = value.replace(/(https?:\/\/)[^\s/@]+(?::[^\s/@]*)?@/gi, "$1[REDACTED]@");
    for (const secret of secrets.filter((s): s is string => Boolean(s)).sort((a, b) => b.length - a.length)) {
      result = result.split(secret).join("[REDACTED]");
    }
    return result;
  };
  return { source: source ? redact(source) : undefined, redact };
}

export function toStructuredError(
  error: unknown,
  opts?: ErrorOptions,
  context: ErrorContext = {},
): StructuredError {
  const details = error && typeof error === "object" ? error as Record<string, unknown> : {};
  const rawMessage = error instanceof Error ? error.message : String(error);
  const status = typeof details.statusCode === "number" && details.statusCode >= 100
    ? details.statusCode : undefined;
  const namedCode = typeof details.code === "string" ? details.code : "";
  let code = "COMMAND_FAILED";
  let hint = "Review the command arguments and error message before retrying.";
  let retryable = false;
  let message = rawMessage;
  if ((error instanceof Error && /YAML|ParseError/.test(error.name)) || /^(EACCES|EPERM|EISDIR)$/.test(namedCode)) {
    code = "CONFIGURATION_ERROR";
    message = "Configuration could not be read. Check config.yml syntax and permissions.";
    hint = "Correct the local configuration without exposing credential values.";
  } else if (status !== undefined) {
    if (status === 401) { code = "AUTHENTICATION_REQUIRED"; hint = "Authenticate the selected Profile with 'mb auth login'."; }
    else if (status === 403) { code = "PERMISSION_DENIED"; hint = "Use a Profile permitted to access this resource."; }
    else if (status === 404) { code = "NOT_FOUND"; hint = "Check the resource ID and selected Profile."; }
    else if (status === 429) { code = "RATE_LIMITED"; hint = "Wait before retrying; honor the server's Retry-After header."; retryable = true; }
    else if (status >= 500) { code = "SERVER_ERROR"; hint = "Check service availability before retrying; writes may already have taken effect."; retryable = true; }
    else { code = "API_ERROR"; hint = "Correct the request using the Metabase error details."; }
  } else if (namedCode.startsWith("commander.") || /must |required|cannot be combined|Unknown (parameter|template tag)|Invalid JMESPath/i.test(rawMessage)) {
    code = "INVALID_INPUT";
    hint = "Use 'mb schema' or command --help to inspect accepted arguments.";
  } else if (/Unknown Profile|Bare override|Profile selection|No Metabase host configured|Profile.*changed during/.test(rawMessage)) {
    code = "CONFIGURATION_ERROR";
    hint = "Inspect 'mb auth list' and select a valid Profile or a complete host/token pair.";
  } else if (/fetch failed/i.test(rawMessage)) {
    code = "NETWORK_ERROR";
    hint = "Check the instance URL and network connection before retrying.";
    retryable = true;
  }
  // Explicit application/transport codes take precedence over heuristics.
  if (/^[A-Z][A-Z0-9_]+$/.test(namedCode) && !/^(EACCES|EPERM|EISDIR)$/.test(namedCode)) code = namedCode;
  if (typeof details.retryable === "boolean") retryable = details.retryable;
  if (typeof details.hint === "string") hint = details.hint;
  const { source, redact } = errorContext(opts, context);
  return { code, message: redact(message), ...(status ? { http_status: status } : {}),
    retryable, hint: redact(hint), ...(source ? { source } : {}) };
}

export function handleCommandError(error: unknown, opts?: ErrorOptions, context: ErrorContext = {}): void {
  const formatted = toStructuredError(error, opts, context);
  const mode = opts?.errorFormat ?? process.env.MB_ERROR_FORMAT ?? "text";
  if (mode === "json") {
    process.stderr.write(JSON.stringify(formatted) + "\n");
  } else {
    process.stderr.write(`${formatted.source ? `[${formatted.source}] ` : ""}Error: ${formatted.message}\n`);
  }
  process.exitCode = 1;
}
