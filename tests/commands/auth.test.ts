import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { mockFetch, resetMock } from "../helpers/mock-server.js";

let testHome: string;

describe("auth commands", () => {
  beforeEach(() => {
    vi.resetModules();
    testHome = join(tmpdir(), `mb-authcmd-test-${Date.now()}`);
    mkdirSync(testHome, { recursive: true });
    vi.stubEnv("HOME", testHome);
    vi.stubEnv("USERPROFILE", testHome);
    vi.stubEnv("MB_HOST", "");
    vi.stubEnv("MB_TOKEN", "");
    vi.stubEnv("MB_SESSION_TOKEN", "");
    vi.stubEnv("MB_USERNAME", "");
    vi.stubEnv("MB_PASSWORD", "");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    resetMock();
  });

  // ── login ──────────────────────────────────────────────

  describe("login with --token", () => {
    it("stores API key to config", async () => {
      const { handleLoginToken } = await import(
        "../../src/commands/auth/login.js"
      );
      await handleLoginToken("https://metabase.test.com", "mb_apikey123");

      const configPath = join(testHome, ".config", "mb", "config.yml");
      const content = readFileSync(configPath, "utf-8");
      expect(content).toContain("mb_apikey123");
      expect(content).toContain("api_key");
      expect(content).toContain("metabase.test.com");
    });
  });

  describe("login with username/password", () => {
    it("calls POST /api/session and stores session token", async () => {
      mockFetch([
        { status: 200, body: { id: "session_token_abc" } },
      ]);
      const { handleLoginPassword } = await import(
        "../../src/commands/auth/login.js"
      );
      await handleLoginPassword(
        "https://metabase.test.com",
        "admin@test.com",
        "password123"
      );

      const configPath = join(testHome, ".config", "mb", "config.yml");
      const content = readFileSync(configPath, "utf-8");
      expect(content).toContain("session_token_abc");
      expect(content).toContain("session");
    });

    it("stores host subpath in config", async () => {
      mockFetch([
        { status: 200, body: { id: "session_token_subpath" } },
      ]);
      const { handleLoginPassword } = await import(
        "../../src/commands/auth/login.js"
      );
      await handleLoginPassword(
        "https://metabase.test.com/root",
        "admin@test.com",
        "password123"
      );

      const configPath = join(testHome, ".config", "mb", "config.yml");
      const content = readFileSync(configPath, "utf-8");
      expect(content).toContain("metabase.test.com/root");
      expect(content).toContain("session_token_subpath");
    });
  });

  describe("login with MB_HOST env (--host not required)", () => {
    it("resolves host from MB_HOST when --host is not passed", async () => {
      vi.stubEnv("MB_HOST", "https://env-host.example.com");
      const { handleLoginToken } = await import(
        "../../src/commands/auth/login.js"
      );
      await handleLoginToken("https://env-host.example.com", "mb_envkey");

      const configPath = join(testHome, ".config", "mb", "config.yml");
      const content = readFileSync(configPath, "utf-8");
      expect(content).toContain("env-host.example.com");
      expect(content).toContain("mb_envkey");
    });
  });

  describe("login with MB_USERNAME + MB_PASSWORD env auto-login", () => {
    it("auto-logs in when env credentials are set", async () => {
      mockFetch([
        { status: 200, body: { id: "auto_session_xyz" } },
      ]);
      vi.stubEnv("MB_USERNAME", "autouser@test.com");
      vi.stubEnv("MB_PASSWORD", "autopass");
      const { handleLoginPassword } = await import(
        "../../src/commands/auth/login.js"
      );
      await handleLoginPassword(
        "https://metabase.test.com",
        "autouser@test.com",
        "autopass"
      );

      const configPath = join(testHome, ".config", "mb", "config.yml");
      const content = readFileSync(configPath, "utf-8");
      expect(content).toContain("auto_session_xyz");
      expect(content).toContain("session");
    });
  });

  // ── logout ─────────────────────────────────────────────

  describe("logout", () => {
    it("clears stored token", async () => {
      const { handleLoginToken } = await import(
        "../../src/commands/auth/login.js"
      );
      await handleLoginToken("https://metabase.test.com", "mb_apikey123");

      const { handleLogout } = await import(
        "../../src/commands/auth/logout.js"
      );
      handleLogout();

      const { loadConfig } = await import("../../src/lib/config.js");
      const config = loadConfig();
      expect(config.hosts["metabase.test.com"]).toBeUndefined();
    });
  });

  // ── status ─────────────────────────────────────────────

  describe("status", () => {
    it("returns auth info when logged in via config", async () => {
      const { handleLoginToken } = await import(
        "../../src/commands/auth/login.js"
      );
      await handleLoginToken("https://metabase.test.com", "mb_apikey123");

      const { getAuthStatus } = await import(
        "../../src/commands/auth/status.js"
      );
      const status = getAuthStatus();
      expect(status.loggedIn).toBe(true);
      expect(status.host).toBe("metabase.test.com");
      expect(status.tokenType).toBe("api_key");
    });

    it("returns not logged in when no config and no env", async () => {
      const { getAuthStatus } = await import(
        "../../src/commands/auth/status.js"
      );
      const status = getAuthStatus();
      expect(status.loggedIn).toBe(false);
    });

    it("detects MB_TOKEN env var (env-only, no config file)", async () => {
      vi.stubEnv("MB_TOKEN", "mb_envonly_key");
      const { getAuthStatus } = await import(
        "../../src/commands/auth/status.js"
      );
      const status = getAuthStatus();
      expect(status.loggedIn).toBe(true);
      expect(status.tokenType).toBe("api_key");
    });

    it("detects MB_SESSION_TOKEN env var (env-only, no config file)", async () => {
      vi.stubEnv("MB_SESSION_TOKEN", "session_from_env");
      const { getAuthStatus } = await import(
        "../../src/commands/auth/status.js"
      );
      const status = getAuthStatus();
      expect(status.loggedIn).toBe(true);
      expect(status.tokenType).toBe("session");
    });

    it("CLI --token takes priority over config", async () => {
      // Store a config token first
      const { handleLoginToken } = await import(
        "../../src/commands/auth/login.js"
      );
      await handleLoginToken("https://metabase.test.com", "mb_configkey");

      const { getAuthStatus } = await import(
        "../../src/commands/auth/status.js"
      );
      const status = getAuthStatus({ token: "mb_clioverride" });
      expect(status.loggedIn).toBe(true);
      expect(status.tokenType).toBe("api_key");
    });

    it("formats output as structured JSON data", async () => {
      const { handleLoginToken } = await import(
        "../../src/commands/auth/login.js"
      );
      await handleLoginToken("https://metabase.test.com", "mb_structured");

      const { getAuthStatus } = await import(
        "../../src/commands/auth/status.js"
      );
      const status = getAuthStatus();

      // Verify it returns a structured object suitable for formatter.output()
      expect(status).toMatchObject({
        loggedIn: true,
        host: "metabase.test.com",
        tokenType: "api_key",
      });
    });
  });
});
