import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
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

  it("runs against a migrated Active Profile without flag changes", async () => {
    vi.stubEnv("MB_HOST", "");
    vi.stubEnv("MB_TOKEN", "");
    const configDir = join(testHome, ".config", "mb");
    mkdirSync(configDir, { recursive: true });
    writeFileSync(
      join(configDir, "config.yml"),
      `current_host: migrated.example.com/root
hosts:
  migrated.example.com/root:
    protocol: https
    token: mb_migrated
    token_type: api_key
    default_db: 42
`
    );
    mockFetch([{
      status: 200,
      body: {
        data: {
          rows: [[1]],
          cols: [{ name: "id", display_name: "ID", base_type: "type/Integer" }],
        },
      },
    }]);

    const { handleQuery } = await import("../../src/commands/query.js");
    const result = await handleQuery("SELECT id FROM migrated_table", {});

    expect(result.data).toEqual([{ id: 1 }]);
    const [call] = getFetchCalls();
    expect(call.url).toBe("https://migrated.example.com/root/api/dataset");
    expect(call.init?.headers).toMatchObject({ "X-Api-Key": "mb_migrated" });
    expect(JSON.parse(call.init?.body as string).database).toBe(42);
  });

  it("runs against the selected Profile without switching the Active Profile", async () => {
    vi.stubEnv("MB_HOST", "");
    vi.stubEnv("MB_TOKEN", "");
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
    default_db: 1
  staging:
    instance: https://staging.example.com/root
    token: mb_staging
    token_type: api_key
    default_db: 9
hosts: {}
current_host: null
`
    );
    mockFetch([{
      status: 200,
      body: {
        data: {
          rows: [[7]],
          cols: [{ name: "id", display_name: "ID", base_type: "type/Integer" }],
        },
      },
    }]);

    const { handleQuery } = await import("../../src/commands/query.js");
    await handleQuery("SELECT id FROM profile_table", { profile: "staging" });

    const [call] = getFetchCalls();
    expect(call.url).toBe("https://staging.example.com/root/api/dataset");
    expect(call.init?.headers).toMatchObject({ "X-Api-Key": "mb_staging" });
    expect(JSON.parse(call.init?.body as string).database).toBe(9);
  });

  it("honours MB_PROFILE for a single invocation", async () => {
    vi.stubEnv("MB_HOST", "");
    vi.stubEnv("MB_TOKEN", "");
    vi.stubEnv("MB_PROFILE", "staging");
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
    default_db: 1
  staging:
    instance: https://staging.example.com
    token: mb_staging
    token_type: api_key
    default_db: 9
hosts: {}
current_host: null
`
    );
    mockFetch([{
      status: 200,
      body: {
        data: {
          rows: [[9]],
          cols: [{ name: "id", display_name: "ID", base_type: "type/Integer" }],
        },
      },
    }]);

    const { handleQuery } = await import("../../src/commands/query.js");
    await handleQuery("SELECT id FROM env_profile_table", {});

    const [call] = getFetchCalls();
    expect(call.url).toBe("https://staging.example.com/api/dataset");
    expect(JSON.parse(call.init?.body as string).database).toBe(9);
  });

  it("uses bare override credentials without writing a Profile", async () => {
    mockFetch([{
      status: 200,
      body: {
        data: {
          rows: [[1]],
          cols: [{ name: "id", display_name: "ID", base_type: "type/Integer" }],
        },
      },
    }]);

    const { handleQuery } = await import("../../src/commands/query.js");
    await handleQuery("SELECT id FROM bare_table", { db: 3 });

    const [call] = getFetchCalls();
    expect(call.url).toBe("https://metabase.test.com/api/dataset");
    expect(call.init?.headers).toMatchObject({ "X-Api-Key": "mb_testkey" });
    expect(existsSync(join(testHome, ".config", "mb", "config.yml"))).toBe(
      false
    );
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
