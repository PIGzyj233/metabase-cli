import { afterEach, describe, expect, it, vi } from "vitest";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { ApiError } from "../../src/lib/api-client.js";
import { CliError } from "../../src/lib/cli-error.js";
import { handleCommandError, toStructuredError } from "../../src/lib/errors.js";

const bare = { host: "https://mb.invalid", token: "mb_test_secret", errorFormat: "json" as const };
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); process.exitCode = undefined; });

function cli(args: string[], env: Record<string, string> = {}) {
  const clean = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith("MB_")));
  return new Promise<{ code: number | null; stdout: string; stderr: string }>((resolve, reject) => {
    const child = spawn(process.execPath, ["--import", "tsx", "src/index.ts", ...args], { env: { ...clean, ...env } });
    let stdout = "", stderr = "";
    child.stdout.on("data", c => { stdout += c; }); child.stderr.on("data", c => { stderr += c; });
    child.on("error", reject); child.on("close", code => resolve({ code, stdout, stderr }));
  });
}

describe("structured errors", () => {
  it.each([
    [401, "AUTHENTICATION_REQUIRED", false], [403, "PERMISSION_DENIED", false],
    [404, "NOT_FOUND", false], [429, "RATE_LIMITED", true], [503, "SERVER_ERROR", true],
  ])("classifies HTTP %s without losing its status", (status, code, retryable) => {
    expect(toStructuredError(Object.assign(new ApiError(Number(status), "failed"), { retryable }), bare)).toMatchObject({
      code, http_status: status, retryable, source: "mb.invalid",
    });
  });

  it("redacts explicit and environment credentials from messages and hints", () => {
    vi.stubEnv("MB_PASSWORD", "password-secret");
    const error = new CliError("NETWORK_ERROR", "mb_test_secret password-secret https://user:pass@host.test", "retry mb_test_secret", true);
    const result = toStructuredError(error, bare);
    expect(JSON.stringify(result)).not.toContain("mb_test_secret");
    expect(JSON.stringify(result)).not.toContain("password-secret");
    expect(JSON.stringify(result)).not.toContain("user:pass");
    expect(result.code).toBe("NETWORK_ERROR");
  });

  it("does not include YAML snippets or stacks", () => {
    const error = new Error("token: confidential-required\ninvalid indentation"); error.name = "YAMLParseError";
    const result = toStructuredError(error, undefined);
    expect(result.code).toBe("CONFIGURATION_ERROR");
    expect(JSON.stringify(result)).not.toContain("confidential");
    expect(result).not.toHaveProperty("stack");
  });

  it("emits exactly one JSON error line with a nonzero exit status", () => {
    const stderr = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    handleCommandError(new CliError("QUERY_FAILED", "Invalid SQL", "Fix SQL"), bare);
    expect(stderr).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String(stderr.mock.calls[0][0]))).toMatchObject({ code: "QUERY_FAILED", retryable: false });
    expect(process.exitCode).toBe(1);
  });

  it("handles Commander errors even when --error-format follows the invalid option", async () => {
    const result = await cli(["query", "SELECT 1", "--db", "oops", "--error-format", "json"]);
    expect(result.code).toBe(1); expect(result.stdout).toBe("");
    expect(JSON.parse(result.stderr)).toMatchObject({ code: "INVALID_INPUT", retryable: false });
  });

  it("supports MB_ERROR_FORMAT and keeps help usable", async () => {
    const invalid = await cli(["unknown-command"], { MB_ERROR_FORMAT: "json" });
    expect(JSON.parse(invalid.stderr)).toMatchObject({ code: "INVALID_INPUT" });
    const help = await cli(["--help"], { MB_ERROR_FORMAT: "json" });
    expect(help.code).toBe(0); expect(help.stdout).toContain("Usage: mb"); expect(help.stderr).toBe("");
  });

  it("returns a stable query failure through the real CLI without stdout data", async () => {
    const server = createServer((_req, res) => {
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ status: "failed", error: "Unknown table" }));
    });
    await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
    try {
      const port = (server.address() as { port: number }).port;
      const result = await cli(["query", "SELECT 1", "--db", "1", "--error-format", "json"], {
        MB_HOST: `http://127.0.0.1:${port}`, MB_TOKEN: "mb_fake",
      });
      expect(result.code).toBe(1); expect(result.stdout).toBe("");
      expect(JSON.parse(result.stderr)).toMatchObject({ code: "QUERY_FAILED", message: "Unknown table" });
    } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
  });
});
