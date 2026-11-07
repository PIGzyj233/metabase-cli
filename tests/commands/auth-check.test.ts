import { afterEach, describe, expect, it, vi } from "vitest";
import { Command } from "commander";
import { handleAuthCheck, registerAuthCheckCommand } from "../../src/commands/auth/check.js";
import { mockFetch, getFetchCalls, resetMock } from "../helpers/mock-server.js";

const identity = { host: "https://check.invalid", token: "mb_fixture" };
afterEach(() => { resetMock(); vi.restoreAllMocks(); process.exitCode = undefined; });

describe("auth check", () => {
  it.each([[{ id: 1 }], { data: [{ id: 1 }] }])("verifies database-list access without executing SQL", async (payload) => {
    mockFetch([{ status: 200, body: payload }]);
    const result = await handleAuthCheck(identity);
    expect(result).toMatchObject({ reachable: true, authenticated: true, database_count: 1 });
    expect(result.elapsed_ms).toBeGreaterThanOrEqual(0);
    expect(getFetchCalls()).toHaveLength(1);
    expect(getFetchCalls()[0].url).toBe("https://check.invalid/api/database");
    expect(getFetchCalls()[0].init?.method).toBe("GET");
    expect(JSON.stringify(result)).not.toContain(identity.token);
  });

  it("does not report malformed success payloads as valid authentication", async () => {
    mockFetch([{ status: 200, body: { login: true } }]);
    await expect(handleAuthCheck(identity)).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
  });

  it("exits nonzero without a success record when the server denies access", async () => {
    mockFetch([{ status: 403, body: { message: "Forbidden" } }]);
    const stdout = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    const program = new Command().option("--host <url>").option("--token <token>");
    registerAuthCheckCommand(program.command("auth"));
    await program.parseAsync(["node", "mb", "auth", "check", "--host", identity.host, "--token", identity.token]);
    expect(process.exitCode).toBe(1);
    expect(stdout).not.toHaveBeenCalled();
  });
});
