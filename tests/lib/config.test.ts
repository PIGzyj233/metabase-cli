import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { parse } from "yaml";

// We'll mock HOME to use a temp dir
let testHome: string;

// Tests will import from the module after setting up mocks
describe("config", () => {
  beforeEach(() => {
    vi.resetModules();
    testHome = join(tmpdir(), `mb-test-${Date.now()}`);
    mkdirSync(testHome, { recursive: true });
    // Override HOME for config path resolution
    vi.stubEnv("HOME", testHome);
    vi.stubEnv("USERPROFILE", testHome);
    // Clear all MB_ env vars
    vi.stubEnv("MB_HOST", "");
    vi.stubEnv("MB_TOKEN", "");
    vi.stubEnv("MB_SESSION_TOKEN", "");
    vi.stubEnv("MB_USERNAME", "");
    vi.stubEnv("MB_PASSWORD", "");
    vi.stubEnv("MB_DEFAULT_DB", "");
    vi.stubEnv("MB_FORMAT", "");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns empty config when no config file exists", async () => {
    const { loadConfig } = await import("../../src/lib/config.js");
    const config = loadConfig();
    expect(config.hosts).toEqual({});
    expect(config.current_host).toBeUndefined();
  });

  it("migrates legacy config from YAML file", async () => {
    const configDir = join(testHome, ".config", "mb");
    mkdirSync(configDir, { recursive: true });
    const configPath = join(configDir, "config.yml");
    writeFileSync(
      configPath,
      `current_host: metabase.example.com
hosts:
  metabase.example.com:
    protocol: https
    token: mb_test123
    token_type: api_key
    default_db: 1
`
    );
    // Re-import to pick up new HOME
    const { loadConfig } = await import("../../src/lib/config.js");
    const config = loadConfig();
    expect(config.version).toBe(2);
    expect(config.current_profile).toBe("metabase-example-com");
    expect(config.current_host).toBeNull();
    expect(config.hosts).toEqual({});
    expect(config.profiles?.["metabase-example-com"]).toMatchObject({
      instance: "https://metabase.example.com",
      token: "mb_test123",
      token_type: "api_key",
      default_db: 1,
    });

    const persisted = parse(readFileSync(configPath, "utf-8"));
    expect(persisted.hosts).toEqual({});
    expect(persisted.current_host).toBeNull();
  });

  it("does not migrate an already-v2 config", async () => {
    const configDir = join(testHome, ".config", "mb");
    mkdirSync(configDir, { recursive: true });
    const configPath = join(configDir, "config.yml");
    writeFileSync(
      configPath,
      `version: 2
current_profile: prod
profiles:
  prod:
    instance: https://prod.example.com
    token: mb_prod
    token_type: api_key
hosts:
  rollback.example.com:
    protocol: https
    token: mb_rollback
    token_type: api_key
current_host: rollback.example.com
`
    );
    const stderr = vi
      .spyOn(process.stderr, "write")
      .mockImplementation(() => true);

    const { loadConfig } = await import("../../src/lib/config.js");
    const config = loadConfig();

    expect(config.current_profile).toBe("prod");
    expect(config.profiles?.prod.token).toBe("mb_prod");
    expect(stderr).not.toHaveBeenCalled();
    expect(readFileSync(configPath, "utf-8")).toContain("rollback.example.com");
  });

  it("derives deterministic Profile aliases from Host keys", async () => {
    const { deriveProfileAlias } = await import("../../src/lib/config.js");

    expect(deriveProfileAlias("metabase.example.com/root")).toBe(
      "metabase-example-com-root"
    );
    expect(
      deriveProfileAlias("very.long.metabase.example.com/path/to/customer", [])
    ).toBe("very-long-metabase-example-com-p");
    expect(
      deriveProfileAlias("metabase.example.com/root", [
        "metabase-example-com-root",
      ])
    ).toBe("metabase-example-com-root-2");
  });

  it("saves config to YAML file", async () => {
    const { saveConfig, getConfigPath } = await import(
      "../../src/lib/config.js"
    );
    saveConfig({
      current_host: "test.example.com",
      hosts: {
        "test.example.com": {
          protocol: "https",
          token: "mb_abc",
          token_type: "api_key",
        },
      },
    });
    const configPath = getConfigPath();
    expect(existsSync(configPath)).toBe(true);
    const content = readFileSync(configPath, "utf-8");
    expect(content).toContain("test.example.com");
    expect(content).toContain("mb_abc");
  });

  it("resolves host from env var MB_HOST", async () => {
    vi.stubEnv("MB_HOST", "https://env.example.com");
    const { resolveHost } = await import("../../src/lib/config.js");
    const host = resolveHost({});
    expect(host).toBe("env.example.com");
  });

  it("resolves host from CLI flag over env var", async () => {
    vi.stubEnv("MB_HOST", "https://env.example.com");
    const { resolveHost } = await import("../../src/lib/config.js");
    const host = resolveHost({ host: "https://cli.example.com" });
    expect(host).toBe("cli.example.com");
  });

  it("preserves subpath when resolving host from env var", async () => {
    vi.stubEnv("MB_HOST", "https://env.example.com/metabase");
    const { resolveHost } = await import("../../src/lib/config.js");
    const host = resolveHost({});
    expect(host).toBe("env.example.com/metabase");
  });

  it("preserves subpath when resolving host from CLI flag", async () => {
    vi.stubEnv("MB_HOST", "https://env.example.com/root");
    const { resolveHost } = await import("../../src/lib/config.js");
    const host = resolveHost({ host: "https://cli.example.com/metabase" });
    expect(host).toBe("cli.example.com/metabase");
  });

  it("resolves default_db from env var MB_DEFAULT_DB", async () => {
    vi.stubEnv("MB_DEFAULT_DB", "5");
    const { resolveDefaultDb } = await import("../../src/lib/config.js");
    expect(resolveDefaultDb({})).toBe(5);
  });

  it("resolves format from env var MB_FORMAT", async () => {
    vi.stubEnv("MB_FORMAT", "csv");
    const { resolveFormat } = await import("../../src/lib/config.js");
    expect(resolveFormat({})).toBe("csv");
  });

  it("CLI format flag overrides env var", async () => {
    vi.stubEnv("MB_FORMAT", "csv");
    const { resolveFormat } = await import("../../src/lib/config.js");
    expect(resolveFormat({ format: "table" })).toBe("table");
  });
});
