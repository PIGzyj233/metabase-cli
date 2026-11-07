import { Command, InvalidArgumentError, Option } from "commander";
import { parseNonNegativeInteger, parsePositiveInteger } from "./input-validation.js";
import type { GlobalOptions } from "../types/index.js";

const MAX_TIMER_MS = 2_147_483_647;
const MAX_RETRY_DELAY_MS = 30_000;
const RETRYABLE_STATUSES = new Set([429, 502, 503, 504]);
const NETWORK_CODES = new Set([
  "ECONNRESET", "ECONNREFUSED", "EPIPE", "ETIMEDOUT", "EAI_AGAIN",
  "ENOTFOUND", "UND_ERR_CONNECT_TIMEOUT", "UND_ERR_SOCKET",
]);

export class TransportError extends Error {
  constructor(
    public code: "REQUEST_TIMEOUT" | "DEADLINE_EXCEEDED" | "NETWORK_ERROR" | "INVALID_RESPONSE",
    message: string,
    public retryable: boolean,
    public hint: string,
  ) {
    super(message);
    this.name = "TransportError";
  }
}

export class HttpStatusError extends Error {
  constructor(public statusCode: number, message: string, public retryable = false) {
    super(message);
    this.name = "HttpStatusError";
  }
}

interface HttpControls {
  timeout: number;
  deadline: number;
  retries: number;
}

export interface JsonResponse {
  status: number;
  ok: boolean;
  body: any;
  headers: Headers;
}

function parseDuration(value: string | number, label: string): number {
  const duration = parsePositiveInteger(value, label);
  if (duration > MAX_TIMER_MS) {
    throw new InvalidArgumentError(`${label} must not exceed ${MAX_TIMER_MS} milliseconds.`);
  }
  return duration;
}

function parseRetries(value: string | number): number {
  const retries = parseNonNegativeInteger(value, "Retries");
  if (retries > 5) throw new InvalidArgumentError("Retries must not exceed 5.");
  return retries;
}

export function resolveHttpControls(opts: GlobalOptions): HttpControls {
  return {
    timeout: parseDuration(opts.timeout ?? process.env.MB_TIMEOUT ?? 30_000, "Timeout"),
    deadline: parseDuration(opts.deadline ?? process.env.MB_DEADLINE ?? 120_000, "Deadline"),
    retries: parseRetries(opts.retries ?? process.env.MB_RETRIES ?? 2),
  };
}

export function registerHttpOptions(program: Command): void {
  program.addOption(new Option("--timeout <ms>", "Per-request timeout, including response body (milliseconds)")
    .argParser((value) => parseDuration(value, "Timeout")).env("MB_TIMEOUT").default(30_000));
  program.addOption(new Option("--deadline <ms>", "Total HTTP budget, including retries and session renewal (milliseconds)")
    .argParser((value) => parseDuration(value, "Deadline")).env("MB_DEADLINE").default(120_000));
  program.addOption(new Option("--retries <n>", "Additional attempts for transient GET failures only (0-5)")
    .argParser(parseRetries).env("MB_RETRIES").default(2));
}

function deadlineError(): TransportError {
  return new TransportError("DEADLINE_EXCEEDED", "The total HTTP deadline was exceeded.", false,
    "Increase --deadline only if the operation is expected to take longer.");
}

function isNetworkFailure(error: unknown): boolean {
  if (error instanceof TypeError) return true;
  if (!error || typeof error !== "object") return false;
  const candidate = error as { code?: string; cause?: { code?: string } };
  return NETWORK_CODES.has(candidate.code ?? "") || NETWORK_CODES.has(candidate.cause?.code ?? "");
}

function retryDelay(headers: Headers | undefined, attempt: number): number | undefined {
  const value = headers?.get("retry-after");
  if (value) {
    const seconds = /^\d+(?:\.\d+)?$/.test(value.trim()) ? Number(value) : undefined;
    const date = seconds === undefined ? Date.parse(value) : NaN;
    const delay = seconds === undefined ? date - Date.now() : seconds * 1000;
    if (Number.isFinite(delay)) {
      // Never retry earlier than the server requests. Excessive Retry-After
      // values stop retries instead of keeping a CLI process asleep indefinitely.
      return delay > MAX_RETRY_DELAY_MS ? undefined : Math.max(0, delay);
    }
  }
  return Math.min(250 * 2 ** attempt, MAX_RETRY_DELAY_MS);
}

export class HttpTransport {
  private readonly controls: HttpControls;
  private readonly expiresAt: number;

  constructor(opts: GlobalOptions = {}) {
    this.controls = resolveHttpControls(opts);
    this.expiresAt = performance.now() + this.controls.deadline;
  }

  private remaining(): number {
    return this.expiresAt - performance.now();
  }

  private async attempt(url: string, init: RequestInit): Promise<JsonResponse> {
    const remaining = this.remaining();
    if (remaining <= 0) throw deadlineError();
    const deadlineLimited = remaining <= this.controls.timeout;
    const controller = new AbortController();
    const timeoutError = deadlineLimited ? deadlineError() : new TransportError(
      "REQUEST_TIMEOUT", `HTTP request exceeded ${this.controls.timeout} milliseconds.`,
      (init.method ?? "GET").toUpperCase() === "GET",
      "Increase --timeout for slow reads. A timed-out write may have completed; verify its result before trying again.",
    );
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timedOut = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => {
        controller.abort(timeoutError);
        reject(timeoutError);
      }, Math.min(this.controls.timeout, remaining));
    });
    try {
      const operation = (async () => {
        const response = await fetch(url, { ...init, signal: controller.signal });
        let body: any = null;
        if (response.status !== 204 && response.status !== 205) {
          try {
            body = await response.json();
          } catch (error) {
            if (controller.signal.aborted) throw timeoutError;
            if (isNetworkFailure(error)) throw error;
            if (response.ok) {
              throw new TransportError("INVALID_RESPONSE", "Metabase returned an invalid JSON response.", false,
                "Check the Metabase base URL and any proxy response before retrying.");
            }
            body = {};
          }
        }
        return { status: response.status, ok: response.ok, body, headers: response.headers };
      })();
      return await Promise.race([operation, timedOut]);
    } finally {
      if (timer !== undefined) clearTimeout(timer);
    }
  }

  async requestJson(url: string, init: RequestInit = {}): Promise<JsonResponse> {
    const method = (init.method ?? "GET").toUpperCase();
    const canRetry = method === "GET";
    for (let attempt = 0; ; attempt++) {
      let response: JsonResponse | undefined;
      let failure: unknown;
      try {
        response = await this.attempt(url, { ...init, method });
      } catch (error) {
        if (error instanceof TransportError) {
          if (error.code !== "REQUEST_TIMEOUT") throw error;
          failure = error;
        } else if (isNetworkFailure(error)) {
          failure = new TransportError("NETWORK_ERROR", "Unable to complete the HTTP request.", canRetry,
            "Check network connectivity and the Metabase URL. Verify the outcome of a failed write before trying again.");
        } else {
          throw error;
        }
      }
      if (response && (!canRetry || !RETRYABLE_STATUSES.has(response.status))) return response;
      if (!canRetry || attempt >= this.controls.retries) {
        if (failure) throw failure;
        return response!;
      }
      const delay = retryDelay(response?.headers, attempt);
      if (delay === undefined || delay >= this.remaining()) {
        if (failure) throw failure;
        return response!;
      }
      await new Promise<void>((resolve) => setTimeout(resolve, delay));
    }
  }
}

const invocationTransports = new WeakMap<GlobalOptions, HttpTransport>();

export function getInvocationTransport(opts: GlobalOptions): HttpTransport {
  let transport = invocationTransports.get(opts);
  if (!transport) {
    transport = new HttpTransport(opts);
    invocationTransports.set(opts, transport);
  }
  return transport;
}

export function inheritInvocationTransport(original: GlobalOptions, delegated: GlobalOptions): void {
  invocationTransports.set(delegated, getInvocationTransport(original));
}
