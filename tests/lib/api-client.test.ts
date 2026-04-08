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

  it("sends PUT request with JSON body", async () => {
    mockFetch([{ status: 200, body: { id: 1, name: "Updated" } }]);
    const { createApiClient } = await import("../../src/lib/api-client.js");
    const client = createApiClient({});
    const data = await client.put("/api/card/1", { name: "Updated" });
    expect(data).toEqual({ id: 1, name: "Updated" });
    const calls = getFetchCalls();
    expect(calls[0].init?.method).toBe("PUT");
    const sentBody = JSON.parse(calls[0].init?.body as string);
    expect(sentBody).toEqual({ name: "Updated" });
  });

  it("sends PUT request with query params", async () => {
    mockFetch([{ status: 200, body: { id: 1 } }]);
    const { createApiClient } = await import("../../src/lib/api-client.js");
    const client = createApiClient({});
    const data = await client.put(
      "/api/card/1",
      { name: "Updated" },
      { delete_old_dashcards: "true" },
    );
    expect(data).toEqual({ id: 1 });
    const calls = getFetchCalls();
    expect(calls[0].url).toContain("?delete_old_dashcards=true");
  });

  it("retries PUT on 401 when credentials available", async () => {
    vi.stubEnv("MB_TOKEN", "");
    vi.stubEnv("MB_SESSION_TOKEN", "expired_token");
    vi.stubEnv("MB_USERNAME", "admin@test.com");
    vi.stubEnv("MB_PASSWORD", "secret");
    mockFetch([
      { status: 401, body: { message: "Unauthenticated" } },
      { status: 200, body: { id: "new_session_token" } },
      { status: 200, body: { id: 1, name: "Updated" } },
    ]);
    const { createApiClient } = await import("../../src/lib/api-client.js");
    const client = createApiClient({});
    const data = await client.put("/api/card/1", { name: "Updated" });
    expect(data).toEqual({ id: 1, name: "Updated" });
    expect(getFetchCalls()).toHaveLength(3);
  });

  it("returns null when retry response is 204", async () => {
    vi.stubEnv("MB_TOKEN", "");
    vi.stubEnv("MB_SESSION_TOKEN", "expired_token");
    vi.stubEnv("MB_USERNAME", "admin@test.com");
    vi.stubEnv("MB_PASSWORD", "secret");
    mockFetch([
      { status: 401, body: { message: "Unauthenticated" } },
      { status: 200, body: { id: "new_session_token" } },
      { status: 204, body: null },
    ]);
    const { createApiClient } = await import("../../src/lib/api-client.js");
    const client = createApiClient({});
    await expect(client.put("/api/card/1", { archived: true })).resolves.toBeNull();
  });

  it("preserves host subpath after 401 renewal stores a new session", async () => {
    vi.stubEnv("MB_HOST", "https://metabase.test.com/root");
    vi.stubEnv("MB_TOKEN", "");
    vi.stubEnv("MB_SESSION_TOKEN", "expired_token");
    vi.stubEnv("MB_USERNAME", "admin@test.com");
    vi.stubEnv("MB_PASSWORD", "secret");
    mockFetch([
      { status: 401, body: { message: "Unauthenticated" } },
      { status: 200, body: { id: "new_session_token" } },
      { status: 200, body: [{ id: 1 }] },
      { status: 200, body: [{ id: 2 }] },
    ]);
    const { createApiClient } = await import("../../src/lib/api-client.js");

    const client = createApiClient({});
    const firstResponse = await client.get("/api/database");
    expect(firstResponse).toEqual([{ id: 1 }]);

    vi.stubEnv("MB_HOST", "");
    vi.stubEnv("MB_SESSION_TOKEN", "");
    vi.stubEnv("MB_USERNAME", "");
    vi.stubEnv("MB_PASSWORD", "");

    const refreshedClient = createApiClient({});
    const secondResponse = await refreshedClient.get("/api/database");
    expect(secondResponse).toEqual([{ id: 2 }]);

    const calls = getFetchCalls();
    expect(calls[0].url).toBe("https://metabase.test.com/root/api/database");
    expect(calls[1].url).toBe("https://metabase.test.com/root/api/session");
    expect(calls[2].url).toBe("https://metabase.test.com/root/api/database");
    expect(calls[3].url).toBe("https://metabase.test.com/root/api/database");
  });

  it("handles 204 No Content on DELETE without throwing", async () => {
    mockFetch([{ status: 204, body: null }]);
    const { createApiClient } = await import("../../src/lib/api-client.js");
    const client = createApiClient({});
    const result = await client.delete("/api/card/1");
    expect(result).toBeNull();
  });

  it("handles 204 No Content on PUT without throwing", async () => {
    mockFetch([{ status: 204, body: null }]);
    const { createApiClient } = await import("../../src/lib/api-client.js");
    const client = createApiClient({});
    const result = await client.put("/api/card/1", { archived: true });
    expect(result).toBeNull();
  });
});
