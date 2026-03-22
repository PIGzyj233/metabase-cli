import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { mockFetch, resetMock, getFetchCalls } from "../helpers/mock-server.js";

let testHome: string;

describe("search command", () => {
  beforeEach(() => {
    vi.resetModules();
    testHome = join(tmpdir(), `mb-search-test-${Date.now()}`);
    mkdirSync(testHome, { recursive: true });
    vi.stubEnv("HOME", testHome);
    vi.stubEnv("USERPROFILE", testHome);
    vi.stubEnv("MB_HOST", "https://metabase.test.com");
    vi.stubEnv("MB_TOKEN", "mb_testkey");
    vi.stubEnv("MB_SESSION_TOKEN", "");
    vi.stubEnv("MB_USERNAME", "");
    vi.stubEnv("MB_PASSWORD", "");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    resetMock();
  });

  it("searches with query string", async () => {
    mockFetch([{
      status: 200,
      body: {
        data: [
          { id: 1, name: "Monthly Revenue", model: "card" },
          { id: 5, name: "Revenue Dashboard", model: "dashboard" },
        ],
      },
    }]);
    const { handleSearch } = await import("../../src/commands/search.js");
    const result = await handleSearch("revenue", {});
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe("Monthly Revenue");
    const calls = getFetchCalls();
    expect(calls[0].url).toContain("q=revenue");
  });

  it("filters by type", async () => {
    mockFetch([{
      status: 200,
      body: {
        data: [{ id: 1, name: "Monthly Revenue", model: "card" }],
      },
    }]);
    const { handleSearch } = await import("../../src/commands/search.js");
    const result = await handleSearch("revenue", { type: "card" });
    expect(result).toHaveLength(1);
    const calls = getFetchCalls();
    expect(calls[0].url).toContain("models=card");
  });

  it("returns empty array when no results", async () => {
    mockFetch([{
      status: 200,
      body: { data: [] },
    }]);
    const { handleSearch } = await import("../../src/commands/search.js");
    const result = await handleSearch("nonexistent", {});
    expect(result).toHaveLength(0);
  });
});
