import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

let testHome: string;

describe("auth", () => {
  beforeEach(() => {
    vi.resetModules();
    testHome = join(tmpdir(), `mb-auth-test-${Date.now()}`);
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
    vi.restoreAllMocks();
  });

  describe("resolveToken", () => {
    it("returns CLI --token with highest priority", async () => {
      vi.stubEnv("MB_TOKEN", "mb_env_token");
      const { resolveToken } = await import("../../src/lib/auth.js");
      const result = resolveToken({ token: "mb_cli_token" });
      expect(result).toEqual({ token: "mb_cli_token", type: "api_key" });
    });

    it("detects API key from mb_ prefix", async () => {
      const { resolveToken } = await import("../../src/lib/auth.js");
      const result = resolveToken({ token: "mb_test123" });
      expect(result).toEqual({ token: "mb_test123", type: "api_key" });
    });

    it("reads MB_TOKEN env var", async () => {
      vi.stubEnv("MB_TOKEN", "mb_envkey");
      const { resolveToken } = await import("../../src/lib/auth.js");
      const result = resolveToken({});
      expect(result).toEqual({ token: "mb_envkey", type: "api_key" });
    });

    it("reads MB_SESSION_TOKEN as session type", async () => {
      vi.stubEnv("MB_SESSION_TOKEN", "sess_abc");
      const { resolveToken } = await import("../../src/lib/auth.js");
      const result = resolveToken({});
      expect(result).toEqual({ token: "sess_abc", type: "session" });
    });

    it("MB_TOKEN takes priority over MB_SESSION_TOKEN", async () => {
      vi.stubEnv("MB_TOKEN", "mb_api");
      vi.stubEnv("MB_SESSION_TOKEN", "sess_abc");
      const { resolveToken } = await import("../../src/lib/auth.js");
      const result = resolveToken({});
      expect(result).toEqual({ token: "mb_api", type: "api_key" });
    });

    it("reads token from config file", async () => {
      const configDir = join(testHome, ".config", "mb");
      mkdirSync(configDir, { recursive: true });
      writeFileSync(
        join(configDir, "config.yml"),
        `current_host: test.com
hosts:
  test.com:
    protocol: https
    token: mb_fromconfig
    token_type: api_key
`
      );
      const { resolveToken } = await import("../../src/lib/auth.js");
      const result = resolveToken({});
      expect(result).toEqual({ token: "mb_fromconfig", type: "api_key" });
    });

    it("returns null when no token available", async () => {
      const { resolveToken } = await import("../../src/lib/auth.js");
      const result = resolveToken({});
      expect(result).toBeNull();
    });
  });

  describe("getAuthHeader", () => {
    it("returns X-Api-Key header for api_key type", async () => {
      const { getAuthHeader } = await import("../../src/lib/auth.js");
      const header = getAuthHeader({ token: "mb_test", type: "api_key" });
      expect(header).toEqual({ "X-Api-Key": "mb_test" });
    });

    it("returns X-Metabase-Session header for session type", async () => {
      const { getAuthHeader } = await import("../../src/lib/auth.js");
      const header = getAuthHeader({ token: "sess_abc", type: "session" });
      expect(header).toEqual({ "X-Metabase-Session": "sess_abc" });
    });
  });

  describe("detectTokenType", () => {
    it("returns api_key for mb_ prefix", async () => {
      const { detectTokenType } = await import("../../src/lib/auth.js");
      expect(detectTokenType("mb_abc123")).toBe("api_key");
    });

    it("returns session for non-mb_ prefix", async () => {
      const { detectTokenType } = await import("../../src/lib/auth.js");
      expect(detectTokenType("some-uuid-token")).toBe("session");
    });
  });
});
