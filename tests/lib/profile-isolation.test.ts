import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { getFetchCalls, mockFetch, resetMock } from "../helpers/mock-server.js";

const configHome = vi.hoisted(() => ({ path: "" }));
vi.mock("node:os", async (importOriginal) => ({
  ...await importOriginal<typeof import("node:os")>(),
  homedir: () => configHome.path,
}));

async function seedProfiles() {
  const { saveConfig } = await import("../../src/lib/config.js");
  saveConfig({
    version: 2, current_profile: "admin", hosts: {},
    profiles: {
      admin: { instance: "https://same.test/root", token: "admin-old", token_type: "session", username: "admin", default_db: 7 },
      analyst: { instance: "https://same.test/root", token: "analyst-old", token_type: "session", username: "analyst", default_db: 8 },
    },
  });
}

beforeEach(async () => {
  vi.resetModules();
  configHome.path = mkdtempSync(join(tmpdir(), "mb-profile-isolation-"));
  for (const key of ["MB_PROFILE", "MB_HOST", "MB_TOKEN", "MB_SESSION_TOKEN", "MB_USERNAME", "MB_PASSWORD", "MB_DEFAULT_DB"]) vi.stubEnv(key, "");
  await seedProfiles();
});
afterEach(() => {
  resetMock();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  process.exitCode = undefined;
  rmSync(configHome.path, { recursive: true, force: true });
});

describe("Profile session renewal isolation", () => {
  it("renews only the selected alias and reuses its token without switching the Active Profile", async () => {
    vi.stubEnv("MB_USERNAME", "analyst");
    vi.stubEnv("MB_PASSWORD", "fake-password");
    mockFetch([
      { status: 401, body: {} },
      { status: 200, body: { id: "analyst-new" } },
      { status: 200, body: [] },
      { status: 200, body: [] },
    ]);
    const { createApiClient } = await import("../../src/lib/api-client.js");
    const { loadConfig } = await import("../../src/lib/config.js");
    const client = createApiClient({ profile: "analyst" });
    await client.get("/api/database");
    await client.get("/api/card");
    expect(loadConfig()).toMatchObject({
      current_profile: "admin",
      profiles: { admin: { token: "admin-old", username: "admin" }, analyst: { token: "analyst-new", username: "analyst", default_db: 8 } },
    });
    expect(getFetchCalls()[3].init?.headers).toHaveProperty("X-Metabase-Session", "analyst-new");
    expect(getFetchCalls()).toHaveLength(4);
  });

  it("rejects renewal credentials for another Profile username before logging in", async () => {
    vi.stubEnv("MB_USERNAME", "admin");
    vi.stubEnv("MB_PASSWORD", "fake-password");
    mockFetch([{ status: 401, body: {} }]);
    const { createApiClient } = await import("../../src/lib/api-client.js");
    await expect(createApiClient({ profile: "analyst" }).get("/api/database")).rejects.toThrow(/does not match Profile/);
    expect(getFetchCalls()).toHaveLength(1);
  });

  it("does not replace an API-key identity with global password credentials", async () => {
    vi.stubEnv("MB_USERNAME", "admin");
    vi.stubEnv("MB_PASSWORD", "fake-password");
    mockFetch([{ status: 401, body: {} }]);
    const { createApiClient } = await import("../../src/lib/api-client.js");
    await expect(createApiClient({ host: "https://same.test", token: "mb_key" }).get("/api/database")).rejects.toThrow(/Not authenticated/);
    expect(getFetchCalls()).toHaveLength(1);
  });

  it("does not overwrite a Profile replaced while renewal was in flight", async () => {
    const { loadConfig, saveConfig } = await import("../../src/lib/config.js");
    const { resolveProfile, renewProfileToken } = await import("../../src/lib/auth.js");
    const identity = resolveProfile({ profile: "analyst" });
    if (identity?.kind !== "profile") throw new Error("Expected Profile");
    const config = loadConfig();
    config.profiles!.analyst.token = "replacement";
    saveConfig(config);
    expect(() => renewProfileToken(identity, "renewed", "analyst")).toThrow(/changed during session renewal/);
    expect(loadConfig().profiles?.analyst.token).toBe("replacement");
  });

  it("attributes output and errors to the invocation identity after Active Profile changes", async () => {
    const { createApiClient } = await import("../../src/lib/api-client.js");
    const { resolveCommandOutputOptions } = await import("../../src/lib/output-options.js");
    const { handleCommandError } = await import("../../src/lib/errors.js");
    const { loadConfig, saveConfig } = await import("../../src/lib/config.js");
    const opts = {};
    createApiClient(opts);
    const config = loadConfig();
    config.current_profile = "analyst";
    saveConfig(config);
    expect(resolveCommandOutputOptions(opts)).toMatchObject({ sourceId: "admin", sourceUrl: "https://same.test/root" });
    const stderr = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    handleCommandError(new Error("failed"), opts);
    expect(stderr).toHaveBeenCalledWith("[admin] Error: failed\n");
  });
});


describe("bare override isolation", () => {
  it.each([
    { host: "https://other.test" },
    { token: "mb_other" },
  ])("rejects incomplete CLI overrides instead of using the Active Profile: %j", async (opts) => {
    const { resolveProfile } = await import("../../src/lib/auth.js");
    expect(() => resolveProfile(opts)).toThrow(/requires both a host.*and a token/);
  });

  it.each(["MB_HOST", "MB_TOKEN", "MB_SESSION_TOKEN"])("rejects incomplete environment overrides: %s", async (key) => {
    vi.stubEnv(key, key === "MB_HOST" ? "https://other.test" : "fake-token");
    const { resolveProfile } = await import("../../src/lib/auth.js");
    expect(() => resolveProfile({})).toThrow(/requires both a host.*and a token/);
  });

  it("does not inherit the Active Profile database for a bare override", async () => {
    const { resolveDefaultDb } = await import("../../src/lib/config.js");
    const opts = { host: "https://other.test", token: "mb_other" };
    expect(resolveDefaultDb(opts)).toBeUndefined();
    expect(resolveDefaultDb({ ...opts, db: 9 })).toBe(9);
    vi.stubEnv("MB_DEFAULT_DB", "10");
    expect(resolveDefaultDb(opts)).toBe(10);
  });

  it("uses only the selected Profile database and rejects unknown Profiles", async () => {
    const { resolveDefaultDb } = await import("../../src/lib/config.js");
    expect(resolveDefaultDb({ profile: "analyst" })).toBe(8);
    expect(() => resolveDefaultDb({ profile: "missing" })).toThrow(/Unknown Profile/);
  });

  it("rejects invalid default database IDs", async () => {
    const { resolveDefaultDb, loadConfig, saveConfig } = await import("../../src/lib/config.js");
    vi.stubEnv("MB_DEFAULT_DB", "1abc");
    expect(() => resolveDefaultDb({})).toThrow(/MB_DEFAULT_DB/);
    vi.stubEnv("MB_DEFAULT_DB", "");
    const config = loadConfig();
    config.profiles!.admin.default_db = -1;
    saveConfig(config);
    expect(() => resolveDefaultDb({})).toThrow(/Profile default_db/);
  });
});
