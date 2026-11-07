import { afterEach, describe, expect, it, vi } from "vitest";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { handleQuery } from "../../src/commands/query.js";
import { handleCardRun } from "../../src/commands/card/run.js";

const identity = { host: "https://metabase.invalid", token: "mb_fake" };

async function runCli(args: string[], envOverrides: Record<string, string> = {}) {
  const env = Object.fromEntries(
    Object.entries(process.env).filter(([key]) => !key.startsWith("MB_")),
  );
  return new Promise<{ code: number | null; stdout: string; stderr: string }>((resolve, reject) => {
    const child = spawn(process.execPath, ["--import", "tsx", "src/index.ts", ...args], {
      cwd: process.cwd(), env: { ...env, ...envOverrides },
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (code) => resolve({ code, stdout, stderr }));
  });
}

afterEach(() => vi.unstubAllGlobals());

describe("query input validation", () => {
  it("rejects invalid numeric CLI inputs without sending a query", async () => {
    let requests = 0;
    const server = createServer((_req, res) => {
      requests++;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ data: { rows: [], cols: [] } }));
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address() as { port: number };
    const env = { MB_HOST: `http://127.0.0.1:${address.port}`, MB_TOKEN: "mb_fake" };
    try {
      for (const args of [
        ["query", "SELECT 1", "--db", "1abc"],
        ["query", "SELECT 1", "--db", "0"],
        ["query", "SELECT 1", "--db", "9007199254740992"],
        ["query", "SELECT 1", "--db", "1", "--limit", "oops"],
        ["query", "SELECT 1", "--db", "1", "--limit", "-1"],
        ["query", "SELECT 1", "--db", "1", "--offset", "1.5"],
        ["card", "run", "12abc"],
        ["card", "run", "12", "--limit", "0"],
        ["card", "run", "12", "--offset", "-1"],
      ]) {
        const result = await runCli(args, env);
        expect(result.code, args.join(" ")).not.toBe(0);
        expect(result.stdout).toBe("");
        expect(result.stderr).toMatch(/integer|must not exceed/);
      }
      expect(requests).toBe(0);
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
  }, 15_000);

  it("also protects handler callers before fetching", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    for (const invalid of [NaN, Infinity, -1, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
      await expect(handleQuery("SELECT 1", { ...identity, db: invalid })).rejects.toThrow();
      await expect(handleQuery("SELECT 1", { ...identity, db: 1, limit: invalid })).rejects.toThrow();
      await expect(handleCardRun(1, { ...identity, offset: invalid })).rejects.toThrow();
    }
    await expect(handleQuery("SELECT 1", { ...identity, db: 0 })).rejects.toThrow(/positive integer/);
    await expect(handleCardRun(0, identity)).rejects.toThrow(/positive integer/);
    expect(fetch).not.toHaveBeenCalled();
  });
});


describe("card parameter validation", () => {
  it("rejects conflicting parameter modes before fetching", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    await expect(handleCardRun(12, {
      ...identity, params: '{"region":"us"}', templateTags: '{"date":"2026-01-01"}',
    })).rejects.toThrow("--params and --template-tags cannot be combined");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("rejects invalid JSON objects before fetching card metadata", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    for (const value of ["", "{", "null", "[]", "123", '"text"']) {
      for (const flag of ["params", "templateTags"]) {
        await expect(handleCardRun(12, { ...identity, [flag]: value })).rejects.toThrow(/JSON/);
      }
    }
    expect(fetch).not.toHaveBeenCalled();
  });
});


describe("output format validation", () => {
  it("rejects invalid explicit and environment formats before the command runs", async () => {
    const env = { MB_HOST: "http://127.0.0.1:1", MB_TOKEN: "mb_fake" };
    for (const [args, overrides] of [
      [["query", "SELECT 1", "--db", "1", "--format", "yaml"], {}],
      [["card", "create", "--name", "test", "--database", "1", "--sql", "SELECT 1"], { MB_FORMAT: "yaml" }],
    ] as [string[], Record<string, string>][]) {
      const result = await runCli(args, { ...env, ...overrides });
      expect(result.code).not.toBe(0);
      expect(result.stdout).toBe("");
      expect(result.stderr).toMatch(/Allowed choices are json, csv, table/);
      expect(result.stderr).not.toMatch(/fetch failed/);
    }
  });
});


describe("JMESPath option compatibility", () => {
  it("supports the accurate name and legacy alias while rejecting invalid syntax before requests", async () => {
    let requests = 0;
    const server = createServer((_req, res) => {
      requests++;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ data: { rows: [[1], [2]], cols: [{ name: "id" }] } }));
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address() as { port: number };
    const env = { MB_HOST: `http://127.0.0.1:${address.port}`, MB_TOKEN: "mb_fake" };
    try {
      for (const flag of ["--jmespath", "--jq"]) {
        const success = await runCli(["query", "SELECT 1", "--db", "1", flag, "[].id"], env);
        expect(success.code).toBe(0);
        expect(JSON.parse(success.stdout)).toEqual([1, 2]);
        const invalid = await runCli(["query", "SELECT 1", "--db", "1", flag, ".[].id"], env);
        expect(invalid.code).not.toBe(0);
        expect(invalid.stdout).toBe("");
        expect(invalid.stderr).toMatch(/Invalid JMESPath expression/);
      }
      const conflict = await runCli([
        "query", "SELECT 1", "--db", "1", "--jq", "[].id", "--jmespath", "[].id",
      ], env);
      expect(conflict.code).not.toBe(0);
      expect(conflict.stderr).toMatch(/cannot be used with/);
      expect(requests).toBe(2);
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
  });
});
