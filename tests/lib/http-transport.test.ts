import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createServer, type Server } from "node:http";
import { Command } from "commander";
import { HttpTransport, getInvocationTransport, inheritInvocationTransport, registerHttpOptions, resolveHttpControls } from "../../src/lib/http-transport.js";

beforeEach(() => {
  vi.stubEnv("MB_TIMEOUT", "30000");
  vi.stubEnv("MB_DEADLINE", "120000");
  vi.stubEnv("MB_RETRIES", "2");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

async function listen(server: Server): Promise<string> {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  return `http://127.0.0.1:${(server.address() as { port: number }).port}`;
}

async function close(server: Server): Promise<void> {
  server.closeAllConnections();
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}

describe("HTTP controls", () => {
  it("validates environment values and permits explicit options to override them", () => {
    expect(resolveHttpControls({})).toEqual({ timeout: 30000, deadline: 120000, retries: 2 });
    vi.stubEnv("MB_TIMEOUT", "12ms");
    expect(() => new HttpTransport()).toThrow(/Timeout/);
    expect(resolveHttpControls({ timeout: 10 })).toMatchObject({ timeout: 10 });
    for (const opts of [{ timeout: 0 }, { deadline: -1 }, { retries: 6 }, { timeout: 2 ** 31 }, { retries: NaN }]) {
      expect(() => new HttpTransport(opts)).toThrow();
    }
  });

  it("registers bounded global flags and environment fallbacks", () => {
    vi.stubEnv("MB_TIMEOUT", "17");
    const program = new Command().exitOverride().configureOutput({ writeErr: () => {} });
    registerHttpOptions(program);
    program.parse(["node", "mb", "--retries", "0", "--deadline", "200"]);
    expect(program.opts()).toMatchObject({ timeout: 17, deadline: 200, retries: 0 });
    const invalid = new Command().exitOverride().configureOutput({ writeErr: () => {} });
    registerHttpOptions(invalid);
    expect(() => invalid.parse(["node", "mb", "--retries", "6"])).toThrow(/Retries/);
  });

  it("shares one HTTP budget through delegated options", () => {
    const original = { deadline: 100 };
    const delegated = { deadline: 100 };
    inheritInvocationTransport(original, delegated);
    expect(getInvocationTransport(original)).toBe(getInvocationTransport(delegated));
  });
});

describe("bounded transport", () => {
  it("times out a response whose headers arrive but body never completes", async () => {
    const server = createServer((_req, res) => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.write('{"rows":');
    });
    const url = await listen(server);
    try {
      await expect(new HttpTransport({ timeout: 40, deadline: 500, retries: 0 }).requestJson(url))
        .rejects.toMatchObject({ code: "REQUEST_TIMEOUT", retryable: true });
    } finally {
      await close(server);
    }
  });

  it("times out waiting for headers without retrying a write", async () => {
    let requests = 0;
    const server = createServer(() => { requests++; });
    const url = await listen(server);
    try {
      await expect(new HttpTransport({ timeout: 40, deadline: 500, retries: 5 }).requestJson(url, { method: "POST", body: "{}" }))
        .rejects.toMatchObject({ code: "REQUEST_TIMEOUT", retryable: false });
      expect(requests).toBe(1);
    } finally {
      await close(server);
    }
  });

  it("uses a total budget across several requests, not a new deadline per call", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "performance"] });
    const fetch = vi.fn(async () => {
      await new Promise((resolve) => setTimeout(resolve, 40));
      return new Response("{}");
    });
    vi.stubGlobal("fetch", fetch);
    const transport = new HttpTransport({ timeout: 100, deadline: 60, retries: 0 });
    const first = transport.requestJson("https://example.invalid");
    await vi.advanceTimersByTimeAsync(40);
    await first;
    const second = expect(transport.requestJson("https://example.invalid")).rejects.toMatchObject({ code: "DEADLINE_EXCEEDED", retryable: false });
    await vi.advanceTimersByTimeAsync(20);
    await second;
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("retries only transient GET status codes and honors Retry-After", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "performance"] });
    const fetch = vi.fn()
      .mockResolvedValueOnce(new Response("{}", { status: 429, headers: { "Retry-After": "1" } }))
      .mockResolvedValueOnce(new Response('{"id":1}'));
    vi.stubGlobal("fetch", fetch);
    const pending = new HttpTransport({ timeout: 100, deadline: 5000, retries: 2 }).requestJson("https://example.invalid");
    await vi.advanceTimersByTimeAsync(999);
    expect(fetch).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect((await pending).body).toEqual({ id: 1 });
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each(["POST", "PUT", "DELETE"])("does not retry %s after server failure", async (method) => {
    const fetch = vi.fn(async () => new Response("{}", { status: 503 }));
    vi.stubGlobal("fetch", fetch);
    const response = await new HttpTransport({ retries: 5 }).requestJson("https://example.invalid", { method });
    expect(response.status).toBe(503);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("does not retry authentication failures or excessive Retry-After", async () => {
    for (const response of [new Response("{}", { status: 401 }), new Response("{}", { status: 429, headers: { "Retry-After": "86400" } })]) {
      const fetch = vi.fn(async () => response);
      vi.stubGlobal("fetch", fetch);
      expect((await new HttpTransport().requestJson("https://example.invalid")).status).toBe(response.status);
      expect(fetch).toHaveBeenCalledTimes(1);
    }
  });

  it("does not wait beyond the deadline for Retry-After", async () => {
    const fetch = vi.fn(async () => new Response("{}", { status: 429, headers: { "Retry-After": "2" } }));
    vi.stubGlobal("fetch", fetch);
    expect((await new HttpTransport({ deadline: 50 }).requestJson("https://example.invalid")).status).toBe(429);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("retries network GET failures with bounded attempts", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "performance"] });
    const fetch = vi.fn(async () => { throw new TypeError("fetch failed with private URL and credentials"); });
    vi.stubGlobal("fetch", fetch);
    const pending = expect(new HttpTransport({ retries: 2 }).requestJson("https://example.invalid"))
      .rejects.toMatchObject({ code: "NETWORK_ERROR", message: "Unable to complete the HTTP request.", retryable: true });
    await vi.advanceTimersByTimeAsync(750);
    await pending;
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("does not retry network failures for write requests", async () => {
    const fetch = vi.fn(async () => { throw new TypeError("fetch failed"); });
    vi.stubGlobal("fetch", fetch);
    await expect(new HttpTransport({ retries: 5 }).requestJson("https://example.invalid", { method: "POST" }))
      .rejects.toMatchObject({ code: "NETWORK_ERROR", retryable: false });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("rejects malformed success JSON without retrying and accepts no-content responses", async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(new Response("<html>proxy error</html>"))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetch);
    const transport = new HttpTransport();
    await expect(transport.requestJson("https://example.invalid")).rejects.toMatchObject({ code: "INVALID_RESPONSE", retryable: false });
    expect((await transport.requestJson("https://example.invalid", { method: "DELETE" })).body).toBeNull();
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});

describe("API transport integration", () => {
  it("keeps the same deadline through session renewal and does not resend an expired operation", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "performance"] });
    vi.stubEnv("MB_HOST", "https://example.invalid");
    vi.stubEnv("MB_TOKEN", "");
    vi.stubEnv("MB_PROFILE", "");
    vi.stubEnv("MB_SESSION_TOKEN", "expired-session");
    vi.stubEnv("MB_USERNAME", "fake-user");
    vi.stubEnv("MB_PASSWORD", "fake-password");
    let requests = 0;
    const fetch = vi.fn(async () => {
      requests++;
      await new Promise((resolve) => setTimeout(resolve, 40));
      return requests === 1
        ? new Response("{}", { status: 401 })
        : new Response('{"id":"new-session"}');
    });
    vi.stubGlobal("fetch", fetch);
    const { createApiClient } = await import("../../src/lib/api-client.js");
    const pending = expect(createApiClient({ timeout: 100, deadline: 60, retries: 0 }).get("/api/database"))
      .rejects.toMatchObject({ code: "DEADLINE_EXCEEDED" });
    await vi.advanceTimersByTimeAsync(60);
    await pending;
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch.mock.calls[1][0]).toBe("https://example.invalid/api/session");
  });

  it("marks exhausted transient write failures as unsafe to retry", async () => {
    const fetch = vi.fn(async () => new Response('{"message":"Unavailable"}', { status: 503 }));
    vi.stubGlobal("fetch", fetch);
    const { createApiClient } = await import("../../src/lib/api-client.js");
    await expect(createApiClient({ host: "https://example.invalid", token: "mb_fake", retries: 5 }).post("/api/card", {}))
      .rejects.toMatchObject({ statusCode: 503, retryable: false, hint: expect.stringContaining("verify the result") });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
