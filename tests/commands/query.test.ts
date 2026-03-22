import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { mockFetch, resetMock, getFetchCalls } from "../helpers/mock-server.js";

let testHome: string;

describe("query command", () => {
  beforeEach(() => {
    vi.resetModules();
    testHome = join(tmpdir(), `mb-query-test-${Date.now()}`);
    mkdirSync(testHome, { recursive: true });
    vi.stubEnv("HOME", testHome);
    vi.stubEnv("USERPROFILE", testHome);
    vi.stubEnv("MB_HOST", "https://metabase.test.com");
    vi.stubEnv("MB_TOKEN", "mb_testkey");
    vi.stubEnv("MB_SESSION_TOKEN", "");
    vi.stubEnv("MB_USERNAME", "");
    vi.stubEnv("MB_PASSWORD", "");
    vi.stubEnv("MB_DEFAULT_DB", "");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    resetMock();
  });

  it("executes SQL and returns formatted results", async () => {
    mockFetch([{
      status: 200,
      body: {
        data: {
          rows: [[1, "Alice"], [2, "Bob"]],
          cols: [
            { name: "id", display_name: "ID", base_type: "type/Integer" },
            { name: "name", display_name: "Name", base_type: "type/Text" },
          ],
        },
      },
    }]);
    const { handleQuery } = await import("../../src/commands/query.js");
    const result = await handleQuery("SELECT id, name FROM users", { db: 1 });
    expect(result.data).toEqual([
      { id: 1, name: "Alice" },
      { id: 2, name: "Bob" },
    ]);
    expect(result.pagination.total).toBe(2);
  });

  it("sends correct POST body to /api/dataset", async () => {
    mockFetch([{
      status: 200,
      body: { data: { rows: [], cols: [] } },
    }]);
    const { handleQuery } = await import("../../src/commands/query.js");
    await handleQuery("SELECT 1", { db: 3 });
    const calls = getFetchCalls();
    const body = JSON.parse(calls[0].init?.body as string);
    expect(body.database).toBe(3);
    expect(body.type).toBe("native");
    expect(body.native.query).toBe("SELECT 1");
  });

  it("applies client-side limit", async () => {
    const rows = Array.from({ length: 200 }, (_, i) => [i]);
    mockFetch([{
      status: 200,
      body: {
        data: {
          rows,
          cols: [{ name: "id", display_name: "ID", base_type: "type/Integer" }],
        },
      },
    }]);
    const { handleQuery } = await import("../../src/commands/query.js");
    const result = await handleQuery("SELECT id FROM big_table", {
      db: 1,
      limit: 50,
    });
    expect(result.data).toHaveLength(50);
    expect(result.pagination.total).toBe(200);
    expect(result.pagination.limit).toBe(50);
    expect(result.pagination.offset).toBe(0);
  });

  it("applies client-side offset", async () => {
    const rows = Array.from({ length: 200 }, (_, i) => [i]);
    mockFetch([{
      status: 200,
      body: {
        data: {
          rows,
          cols: [{ name: "id", display_name: "ID", base_type: "type/Integer" }],
        },
      },
    }]);
    const { handleQuery } = await import("../../src/commands/query.js");
    const result = await handleQuery("SELECT id FROM big_table", {
      db: 1,
      limit: 50,
      offset: 100,
    });
    expect(result.data).toHaveLength(50);
    expect(result.data[0].id).toBe(100);
    expect(result.pagination.offset).toBe(100);
  });
});
