import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

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

  it("reads config from YAML file", async () => {
    const configDir = join(testHome, ".config", "mb");
    mkdirSync(configDir, { recursive: true });
    writeFileSync(
      join(configDir, "config.yml"),
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
    expect(config.current_host).toBe("metabase.example.com");
    expect(config.hosts["metabase.example.com"].token).toBe("mb_test123");
    expect(config.hosts["metabase.example.com"].token_type).toBe("api_key");
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
