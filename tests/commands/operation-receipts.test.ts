import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { mockFetch, getFetchCalls, resetMock } from "../helpers/mock-server.js";

const configHome = vi.hoisted(() => ({ path: "" }));
vi.mock("node:os", async importOriginal => ({
  ...await importOriginal<typeof import("node:os")>(), homedir: () => configHome.path,
}));

beforeEach(async () => {
  vi.resetModules();
  configHome.path = mkdtempSync(join(tmpdir(), "mb-receipts-"));
  for (const key of ["MB_HOST", "MB_TOKEN", "MB_SESSION_TOKEN", "MB_USERNAME", "MB_PASSWORD", "MB_PROFILE", "MB_ERROR_FORMAT", "MB_FORMAT", "MB_TIMEOUT", "MB_DEADLINE", "MB_RETRIES"]) vi.stubEnv(key, undefined);
  const { saveConfig } = await import("../../src/lib/config.js");
  saveConfig({ version: 2, current_profile: "prod", hosts: {}, profiles: {
    prod: { instance: "https://mb.test", token: "mb_prod_secret", token_type: "api_key" },
    staging: { instance: "https://mb.test", token: "session_secret", token_type: "session" },
  } });
  vi.spyOn(process.stdout, "write").mockImplementation(() => true);
  vi.spyOn(process.stderr, "write").mockImplementation(() => true);
});
afterEach(() => { resetMock(); vi.unstubAllEnvs(); vi.restoreAllMocks(); process.exitCode = undefined; rmSync(configHome.path, { recursive: true, force: true }); });

async function execute(args: string[]) {
  const { createProgram } = await import("../../src/program.js");
  const program = createProgram(); program.exitOverride();
  await program.parseAsync(["node", "mb", ...args]);
  const writes = vi.mocked(process.stdout.write).mock.calls.map(call => String(call[0])).join("");
  return writes ? JSON.parse(writes) : undefined;
}

describe("operation receipts", () => {
  it("reports the stored login Profile rather than runtime environment credentials", async () => {
    vi.stubEnv("MB_PROFILE", "missing");
    const rows = await execute(["auth", "login", "--host", "https://other.test", "--token", "mb_login_secret", "--as", "new-profile"]);
    expect(rows).toEqual([{ _source: "new-profile", operation: "login", ok: true, profile: "new-profile", status: "stored", verified: false }]);
    expect(JSON.stringify(rows)).not.toContain("secret");
  });

  it("reports local Profile switching without a request", async () => {
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
    expect(await execute(["auth", "use", "staging"])).toEqual([{ _source: "staging", operation: "use", ok: true, profile: "staging", status: "active" }]);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("reports local removal and a failed best-effort session revocation separately", async () => {
    mockFetch([{ status: 500, body: { message: "failed" } }]);
    const rows = await execute(["auth", "rm", "staging"]);
    expect(rows).toEqual([{ _source: "staging", operation: "rm", ok: true, profile: "staging", status: "removed", session_revoked: false, revoke_status: "failed" }]);
    const { loadConfig } = await import("../../src/lib/config.js");
    expect(loadConfig().profiles?.staging).toBeUndefined();
    expect(getFetchCalls()).toHaveLength(1);
  });

  it("does not claim to revoke API keys", async () => {
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
    const rows = await execute(["auth", "logout"]);
    expect(rows[0]).toMatchObject({ _source: "prod", operation: "logout", ok: true, revoked: false, reason: "api_key", profile_kept: true });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("reports successful session revocation and keeps the Profile", async () => {
    mockFetch([{ status: 204, body: null }]);
    const rows = await execute(["auth", "logout", "--profile", "staging"]);
    expect(rows[0]).toMatchObject({ _source: "staging", operation: "logout", ok: true, revoked: true, profile_kept: true });
    const { loadConfig } = await import("../../src/lib/config.js");
    expect(loadConfig().profiles?.staging).toBeDefined();
  });

  it("fails logout without a success receipt when revocation is rejected", async () => {
    mockFetch([{ status: 503, body: {} }]);
    expect(await execute(["auth", "logout", "--profile", "staging", "--error-format", "json"])).toBeUndefined();
    expect(process.exitCode).toBe(1);
    const stderr = vi.mocked(process.stderr.write).mock.calls.map(call => String(call[0])).join("");
    expect(JSON.parse(stderr)).toMatchObject({ code: "SERVER_ERROR", http_status: 503, retryable: false, source: "staging" });
    expect(getFetchCalls()).toHaveLength(1);
  });

  it.each(["archive", "delete"])("emits a source-attributed %s receipt", async command => {
    mockFetch([
      { status: 200, body: { name: "Report", dataset_query: { type: "native" }, display: "table", visualization_settings: {} } },
      { status: 200, body: { id: 12, archived: true } },
    ]);
    expect(await execute(["card", command, "12"])).toEqual([{ _source: "prod", operation: command, ok: true, id: 12, status: "archived" }]);
  });

  it("emits a permanent deletion receipt only after the server succeeds", async () => {
    mockFetch([{ status: 204, body: null }]);
    expect(await execute(["card", "delete", "12", "--hard-delete"])).toEqual([{ _source: "prod", operation: "delete", ok: true, id: 12, status: "deleted" }]);
  });

  it("keeps the login receipt tied to the persisted alias if another agent switches Active Profile", async () => {
    const auth = await import("../../src/lib/auth.js");
    const { loadConfig, saveConfig } = await import("../../src/lib/config.js");
    const original = auth.storeToken;
    vi.spyOn(auth, "storeToken").mockImplementation((...args) => {
      const alias = original(...args);
      const changed = loadConfig(); changed.current_profile = "prod"; saveConfig(changed);
      return alias;
    });
    const rows = await execute(["auth", "login", "--host", "https://new.test", "--token", "mb_new", "--as", "new-profile"]);
    expect(rows[0]).toMatchObject({ _source: "new-profile", profile: "new-profile" });
    expect(loadConfig().current_profile).toBe("prod");
  });

  it("preserves unrelated Profile changes made while session revocation is pending", async () => {
    const { loadConfig, saveConfig } = await import("../../src/lib/config.js");
    vi.stubGlobal("fetch", vi.fn(async () => {
      const changed = loadConfig();
      changed.profiles!.new = { instance: "https://new.test", token: "mb_new", token_type: "api_key" };
      changed.profiles!.prod.default_db = 9;
      changed.current_profile = "new";
      saveConfig(changed);
      return new Response(null, { status: 204 });
    }));
    const rows = await execute(["auth", "rm", "staging"]);
    expect(rows[0]).toMatchObject({ profile: "staging", status: "removed" });
    expect(loadConfig()).toMatchObject({ current_profile: "new", profiles: { new: { token: "mb_new" }, prod: { default_db: 9 } } });
    expect(loadConfig().profiles?.staging).toBeUndefined();
  });

  it("does not delete a replacement Profile created during revocation", async () => {
    const { loadConfig, saveConfig } = await import("../../src/lib/config.js");
    vi.stubGlobal("fetch", vi.fn(async () => {
      const changed = loadConfig(); changed.profiles!.staging.token = "replacement"; saveConfig(changed);
      return new Response(null, { status: 204 });
    }));
    expect(await execute(["auth", "rm", "staging", "--error-format", "json"])).toBeUndefined();
    expect(loadConfig().profiles?.staging.token).toBe("replacement");
    const stderr = vi.mocked(process.stderr.write).mock.calls.map(call => String(call[0])).join("");
    expect(JSON.parse(stderr)).toMatchObject({ code: "CONFIGURATION_ERROR", source: "staging" });
    expect(process.exitCode).toBe(1);
  });

  it("rejects mixed explicit credential sources before persistence or network calls", async () => {
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
    const { runCli } = await import("../../src/program.js");
    await runCli(["node", "mb", "auth", "login", "--host", "https://new.test", "--token", "mb_secret", "--username", "user", "--password", "password", "--as", "new-profile", "--error-format", "json"]);
    const { loadConfig } = await import("../../src/lib/config.js");
    expect(loadConfig().profiles?.["new-profile"]).toBeUndefined();
    expect(fetch).not.toHaveBeenCalled();
    const stderr = vi.mocked(process.stderr.write).mock.calls.map(call => String(call[0])).join("");
    expect(JSON.parse(stderr)).toMatchObject({ code: "INVALID_INPUT" });
    expect(stderr).not.toContain("mb_secret");
  });

  it("passes the selected request timeout into password login", async () => {
    const { handleLoginPassword } = await import("../../src/commands/auth/login.js");
    const fetch = vi.fn(() => new Promise<Response>(() => {})); vi.stubGlobal("fetch", fetch);
    await expect(handleLoginPassword("https://mb.test", "user", "password", { alias: "new" }, { timeout: 5, deadline: 100, retries: 0 })).rejects.toMatchObject({ code: "REQUEST_TIMEOUT" });
    const { loadConfig } = await import("../../src/lib/config.js");
    expect(loadConfig().profiles?.new).toBeUndefined();
  });
});
