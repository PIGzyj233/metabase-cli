import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const configLocation = vi.hoisted(() => ({ directory: "" }));
vi.mock("node:os", async (original) => ({
  ...await original<typeof import("node:os")>(),
  homedir: () => configLocation.directory,
}));

beforeEach(async () => {
  vi.resetModules();
  configLocation.directory = mkdtempSync(join(tmpdir(), "mb-default-db-"));
  for (const name of ["MB_PROFILE", "MB_HOST", "MB_TOKEN", "MB_SESSION_TOKEN", "MB_DEFAULT_DB"]) vi.stubEnv(name, "");
  const { saveConfig } = await import("../../src/lib/config.js");
  saveConfig({ version: 2, current_profile: "a", hosts: {}, profiles: {
    a: { instance: "https://a.invalid", token: "mb_a", token_type: "api_key", default_db: 1 },
    b: { instance: "https://b.invalid", token: "mb_b", token_type: "api_key" },
  } });
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); rmSync(configLocation.directory, { recursive: true, force: true }); });

describe("Profile default database settings", () => {
  it("updates only the selected Profile offline without switching Active Profile", async () => {
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
    vi.stubEnv("MB_HOST", "https://ephemeral.invalid");
    vi.stubEnv("MB_TOKEN", "mb_ephemeral");
    const { handleAuthSetDefaultDb } = await import("../../src/commands/auth/set-default-db.js");
    const { loadConfig } = await import("../../src/lib/config.js");
    const result = handleAuthSetDefaultDb("9", { profile: "b" });
    expect(result.record).toEqual({ operation: "set-default-db", profile: "b", default_db: 9 });
    expect(loadConfig()).toMatchObject({ current_profile: "a", profiles: { a: { default_db: 1 }, b: { default_db: 9, token: "mb_b" } } });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("uses MB_PROFILE and makes the saved default available to queries", async () => {
    vi.stubEnv("MB_PROFILE", "b");
    const { handleAuthSetDefaultDb } = await import("../../src/commands/auth/set-default-db.js");
    const { resolveDefaultDb } = await import("../../src/lib/config.js");
    handleAuthSetDefaultDb(7, {});
    expect(resolveDefaultDb({})).toBe(7);
  });

  it("rejects invalid values, unknown Profiles and explicit bare overrides without changing config", async () => {
    const { handleAuthSetDefaultDb } = await import("../../src/commands/auth/set-default-db.js");
    const { loadConfig } = await import("../../src/lib/config.js");
    const before = loadConfig();
    expect(() => handleAuthSetDefaultDb("1abc", {})).toThrow(/integer/);
    expect(() => handleAuthSetDefaultDb(2, { profile: "unknown" })).toThrow(/Unknown Profile/);
    expect(() => handleAuthSetDefaultDb(2, { host: "https://other.invalid" })).toThrow(/saved Profile/);
    expect(loadConfig()).toEqual(before);
  });
});
