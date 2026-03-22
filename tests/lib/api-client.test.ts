import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { mockFetch, getFetchCalls, resetMock } from "../helpers/mock-server.js";

let testHome: string;

describe("api-client", () => {
  beforeEach(() => {
    vi.resetModules();
    testHome = join(tmpdir(), `mb-api-test-${Date.now()}`);
    mkdirSync(testHome, { recursive: true });
    vi.stubEnv("HOME", testHome);
    vi.stubEnv("USERPROFILE", testHome);
    vi.stubEnv("MB_HOST", "https://metabase.test.com");
    vi.stubEnv("MB_TOKEN", "mb_testkey123");
    vi.stubEnv("MB_SESSION_TOKEN", "");
    vi.stubEnv("MB_USERNAME", "");
    vi.stubEnv("MB_PASSWORD", "");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    resetMock();
  });

  it("sends GET request with API key header", async () => {
    mockFetch([{ status: 200, body: [{ id: 1, name: "DB1" }] }]);
    const { createApiClient } = await import("../../src/lib/api-client.js");
    const client = createApiClient({});
    const data = await client.get("/api/database");
    expect(data).toEqual([{ id: 1, name: "DB1" }]);
    const calls = getFetchCalls();
    expect(calls[0].url).toBe("https://metabase.test.com/api/database");
    expect(calls[0].init?.headers).toHaveProperty("X-Api-Key", "mb_testkey123");
  });

  it("sends POST request with JSON body", async () => {
    mockFetch([{
      status: 200,
      body: { data: { rows: [[1]], cols: [{ name: "id" }] } },
    }]);
    const { createApiClient } = await import("../../src/lib/api-client.js");
    const client = createApiClient({});
    const data = await client.post("/api/dataset", { database: 1, type: "native", native: { query: "SELECT 1" } });
    expect(data.data.rows).toEqual([[1]]);
    const calls = getFetchCalls();
    expect(calls[0].init?.method).toBe("POST");
  });

  it("throws ApiError on 404", async () => {
    mockFetch([{ status: 404, body: { message: "Not found" } }]);
    const { createApiClient, ApiError } = await import("../../src/lib/api-client.js");
    const client = createApiClient({});
    await expect(client.get("/api/card/999")).rejects.toThrow("Not found");
  });

  it("retries on 401 when credentials available", async () => {
    vi.stubEnv("MB_TOKEN", "");
    vi.stubEnv("MB_SESSION_TOKEN", "expired_token");
    vi.stubEnv("MB_USERNAME", "admin@test.com");
    vi.stubEnv("MB_PASSWORD", "secret");
    mockFetch([
      { status: 401, body: { message: "Unauthenticated" } },
      { status: 200, body: { id: "new_session_token" } },  // POST /api/session
      { status: 200, body: [{ id: 1 }] },                   // retry original
    ]);
    const { createApiClient } = await import("../../src/lib/api-client.js");
    const client = createApiClient({});
    const data = await client.get("/api/database");
    expect(data).toEqual([{ id: 1 }]);
    expect(getFetchCalls()).toHaveLength(3);
  });

  it("throws on 401 when no credentials for renewal", async () => {
    vi.stubEnv("MB_TOKEN", "");
    vi.stubEnv("MB_SESSION_TOKEN", "expired_token");
    mockFetch([{ status: 401, body: { message: "Unauthenticated" } }]);
    const { createApiClient } = await import("../../src/lib/api-client.js");
    const client = createApiClient({});
    await expect(client.get("/api/database")).rejects.toThrow(/mb auth login/);
  });
});
