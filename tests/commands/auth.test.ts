import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Readable } from "node:stream";
import { Command } from "commander";
import { parse } from "yaml";
import { getFetchCalls, mockFetch, resetMock } from "../helpers/mock-server.js";

let testHome: string;

describe("auth commands", () => {
  beforeEach(() => {
    vi.resetModules();
    process.exitCode = undefined;
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

    it("stores API key under the requested Profile alias", async () => {
      const { handleLoginToken } = await import(
        "../../src/commands/auth/login.js"
      );
      await handleLoginToken("https://metabase.test.com", "mb_profilekey", {
        alias: "customer-a",
      });

      const configPath = join(testHome, ".config", "mb", "config.yml");
      const config = parse(readFileSync(configPath, "utf-8"));
      expect(config).toMatchObject({
        version: 2,
        current_profile: "customer-a",
        profiles: {
          "customer-a": {
            instance: "https://metabase.test.com",
            token: "mb_profilekey",
            token_type: "api_key",
          },
        },
      });
    });

    it("rejects an existing Profile alias unless overwrite is set", async () => {
      const { handleLoginToken } = await import(
        "../../src/commands/auth/login.js"
      );
      await handleLoginToken("https://metabase.test.com", "mb_first", {
        alias: "prod",
      });

      await expect(
        handleLoginToken("https://other.test.com", "mb_second", {
          alias: "prod",
        })
      ).rejects.toThrow(/--overwrite/);

      await handleLoginToken("https://other.test.com", "mb_second", {
        alias: "prod",
        overwrite: true,
      });
      const configPath = join(testHome, ".config", "mb", "config.yml");
      const config = parse(readFileSync(configPath, "utf-8"));
      expect(config.profiles.prod).toMatchObject({
        instance: "https://other.test.com",
        token: "mb_second",
      });
    });

    it("rejects invalid and case-colliding Profile aliases", async () => {
      const { handleLoginToken } = await import(
        "../../src/commands/auth/login.js"
      );
      await expect(
        handleLoginToken("https://metabase.test.com", "mb_bad", {
          alias: "current",
        })
      ).rejects.toThrow(/reserved/);
      await expect(
        handleLoginToken("https://metabase.test.com", "mb_bad", {
          alias: "not allowed",
        })
      ).rejects.toThrow(/1-32 characters/);

      await handleLoginToken("https://metabase.test.com", "mb_prod", {
        alias: "Prod",
      });
      await expect(
        handleLoginToken("https://metabase.test.com", "mb_prod_lower", {
          alias: "prod",
        })
      ).rejects.toThrow(/conflicts/);
    });
  });

  describe("login with --token-stdin", () => {
    it("reads and trims the token from stdin", async () => {
      const { readTokenFromStdin } = await import(
        "../../src/commands/auth/login.js"
      );

      await expect(
        readTokenFromStdin(Readable.from(["mb_from_stdin\n"]))
      ).resolves.toBe("mb_from_stdin");
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

  describe("login ignores bare override env", () => {
    it("does not persist MB_HOST when --host is not passed", async () => {
      vi.stubEnv("MB_HOST", "https://env-host.example.com");
      const stderr = vi
        .spyOn(process.stderr, "write")
        .mockImplementation(() => true);
      const program = new Command();
      program.exitOverride();
      program.option("--host <url>");
      const auth = program.command("auth");
      const { registerAuthLoginCommand } = await import(
        "../../src/commands/auth/login.js"
      );
      registerAuthLoginCommand(auth);

      await program.parseAsync([
        "node",
        "mb",
        "auth",
        "login",
        "--token",
        "mb_envkey",
      ]);

      expect(process.exitCode).toBe(1);
      expect(stderr.mock.calls.map((call) => String(call[0])).join(""))
        .toContain("No host specified. Use --host.");
      expect(() =>
        readFileSync(join(testHome, ".config", "mb", "config.yml"), "utf-8")
      ).toThrow();
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
    it("revokes a session Profile without removing it locally", async () => {
      mockFetch([
        { status: 200, body: { id: "session_token_abc" } },
        { status: 204, body: null },
      ]);
      const { handleLoginPassword } = await import(
        "../../src/commands/auth/login.js"
      );
      await handleLoginPassword(
        "https://metabase.test.com",
        "admin@test.com",
        "password123"
      );

      const { handleLogout } = await import(
        "../../src/commands/auth/logout.js"
      );
      await handleLogout();

      const { loadConfig } = await import("../../src/lib/config.js");
      const config = loadConfig();
      expect(config.profiles?.["metabase-test-com"]).toMatchObject({
        token: "session_token_abc",
        token_type: "session",
      });
      const calls = getFetchCalls();
      expect(calls[1].url).toBe("https://metabase.test.com/api/session");
      expect(calls[1].init?.method).toBe("DELETE");
    });
  });

  // ── status ─────────────────────────────────────────────

  describe("list", () => {
    it("lists Profiles without exposing tokens", async () => {
      const configDir = join(testHome, ".config", "mb");
      mkdirSync(configDir, { recursive: true });
      writeFileSync(
        join(configDir, "config.yml"),
        `version: 2
current_profile: prod
profiles:
  prod:
    instance: https://prod.example.com
    token: mb_prod_secret
    token_type: api_key
    username: prod@example.com
  staging:
    instance: https://staging.example.com
    token: session_staging_secret
    token_type: session
hosts: {}
current_host: null
`
      );

      const { getAuthList } = await import(
        "../../src/commands/auth/list.js"
      );
      const rows = getAuthList();

      expect(rows).toEqual([
        {
          _source: "prod",
          alias: "prod",
          instance: "https://prod.example.com",
          tokenType: "api_key",
          username: "prod@example.com",
          active: true,
        },
        {
          _source: "staging",
          alias: "staging",
          instance: "https://staging.example.com",
          tokenType: "session",
          active: false,
        },
      ]);
      expect(JSON.stringify(rows)).not.toContain("secret");
    });
  });

  describe("use", () => {
    it("sets the Active Profile without making a network call", async () => {
      const configDir = join(testHome, ".config", "mb");
      mkdirSync(configDir, { recursive: true });
      writeFileSync(
        join(configDir, "config.yml"),
        `version: 2
current_profile: prod
profiles:
  prod:
    instance: https://prod.example.com
    token: mb_prod
    token_type: api_key
  staging:
    instance: https://staging.example.com
    token: mb_staging
    token_type: api_key
hosts: {}
current_host: null
`
      );
      const fetchSpy = vi.fn();
      vi.stubGlobal("fetch", fetchSpy);

      const { handleAuthUse } = await import(
        "../../src/commands/auth/use.js"
      );
      handleAuthUse("staging");

      const { loadConfig } = await import("../../src/lib/config.js");
      expect(loadConfig().current_profile).toBe("staging");
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });

  describe("rm", () => {
    it("removes a session Profile locally even when revoke fails", async () => {
      const configDir = join(testHome, ".config", "mb");
      mkdirSync(configDir, { recursive: true });
      writeFileSync(
        join(configDir, "config.yml"),
        `version: 2
current_profile: session-profile
profiles:
  session-profile:
    instance: https://session.example.com
    token: session_secret
    token_type: session
  api-profile:
    instance: https://api.example.com
    token: mb_api
    token_type: api_key
hosts: {}
current_host: null
`
      );
      mockFetch([{ status: 500, body: { message: "nope" } }]);

      const { handleAuthRm } = await import("../../src/commands/auth/rm.js");
      await handleAuthRm("session-profile");

      const { loadConfig } = await import("../../src/lib/config.js");
      const config = loadConfig();
      expect(config.profiles?.["session-profile"]).toBeUndefined();
      expect(config.current_profile).toBeNull();
      expect(getFetchCalls()[0].init?.method).toBe("DELETE");
    });
  });

  describe("status", () => {
    it("can inspect a non-active Profile", async () => {
      const configDir = join(testHome, ".config", "mb");
      mkdirSync(configDir, { recursive: true });
      writeFileSync(
        join(configDir, "config.yml"),
        `version: 2
current_profile: prod
profiles:
  prod:
    instance: https://prod.example.com
    token: mb_prod
    token_type: api_key
  staging:
    instance: https://staging.example.com/root
    token: session_staging
    token_type: session
    username: staging@example.com
hosts: {}
current_host: null
`
      );

      const { getAuthStatus } = await import(
        "../../src/commands/auth/status.js"
      );
      expect(getAuthStatus({ profile: "staging" })).toMatchObject({
        loggedIn: true,
        host: "staging.example.com/root",
        tokenType: "session",
        username: "staging@example.com",
      });
    });

    it("migrates legacy config and keeps auth status working", async () => {
      const configDir = join(testHome, ".config", "mb");
      mkdirSync(configDir, { recursive: true });
      const configPath = join(configDir, "config.yml");
      writeFileSync(
        configPath,
        `current_host: legacy.example.com/root
hosts:
  legacy.example.com/root:
    protocol: https
    token: mb_legacykey
    token_type: api_key
    username: legacy@example.com
    default_db: 7
`
      );
      const stderr = vi
        .spyOn(process.stderr, "write")
        .mockImplementation(() => true);

      const { getAuthStatus } = await import(
        "../../src/commands/auth/status.js"
      );
      const status = getAuthStatus();

      expect(status).toMatchObject({
        loggedIn: true,
        host: "legacy.example.com/root",
        tokenType: "api_key",
        username: "legacy@example.com",
      });
      expect(stderr.mock.calls.map((call) => String(call[0])).join(""))
        .toContain("Migrated config to Profile schema");

      const migrated = parse(readFileSync(configPath, "utf-8"));
      expect(migrated).toMatchObject({
        version: 2,
        current_profile: "legacy-example-com-root",
        current_host: null,
        hosts: {},
        profiles: {
          "legacy-example-com-root": {
            instance: "https://legacy.example.com/root",
            token: "mb_legacykey",
            token_type: "api_key",
            username: "legacy@example.com",
            default_db: 7,
          },
        },
      });
    });
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

    it("detects MB_HOST + MB_TOKEN bare override", async () => {
      vi.stubEnv("MB_HOST", "https://env-only.example.com");
      vi.stubEnv("MB_TOKEN", "mb_envonly_key");
      const { getAuthStatus } = await import(
        "../../src/commands/auth/status.js"
      );
      const status = getAuthStatus();
      expect(status.loggedIn).toBe(true);
      expect(status.host).toBe("env-only.example.com");
      expect(status.tokenType).toBe("api_key");
    });

    it("detects MB_HOST + MB_SESSION_TOKEN bare override", async () => {
      vi.stubEnv("MB_HOST", "https://env-session.example.com");
      vi.stubEnv("MB_SESSION_TOKEN", "session_from_env");
      const { getAuthStatus } = await import(
        "../../src/commands/auth/status.js"
      );
      const status = getAuthStatus();
      expect(status.loggedIn).toBe(true);
      expect(status.host).toBe("env-session.example.com");
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

