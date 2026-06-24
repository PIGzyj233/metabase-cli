import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

let testHome: string;

describe("handleCommandError", () => {
  beforeEach(() => {
    vi.resetModules();
    testHome = join(tmpdir(), `mb-errors-test-${Date.now()}`);
    mkdirSync(testHome, { recursive: true });
    vi.stubEnv("HOME", testHome);
    vi.stubEnv("USERPROFILE", testHome);
    vi.stubEnv("MB_HOST", "");
    vi.stubEnv("MB_TOKEN", "");
    vi.stubEnv("MB_PROFILE", "");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("prefixes errors with the selected source id", async () => {
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
hosts: {}
current_host: null
`
    );
    const stderr = vi
      .spyOn(process.stderr, "write")
      .mockImplementation(() => true);

    const { handleCommandError } = await import("../../src/lib/errors.js");
    handleCommandError(new Error("boom"), {});

    expect(String(stderr.mock.calls[0][0])).toBe("[prod] Error: boom\n");
  });
});
