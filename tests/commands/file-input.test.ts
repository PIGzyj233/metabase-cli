import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer, type Server } from "node:http";
import { spawn } from "node:child_process";

let inputDir: string;
let server: Server;
let host: string;
let requests: { method: string | undefined; url: string | undefined; body: any }[];

async function runCli(args: string[], stdin = "") {
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("MB_")));
  return new Promise<{ code: number | null; stdout: string; stderr: string }>((resolve, reject) => {
    const child = spawn(process.execPath, ["--import", "tsx", "src/index.ts", ...args], {
      env: { ...env, MB_HOST: host, MB_TOKEN: "mb_fake" },
      cwd: process.cwd(),
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (data) => { stdout += data; });
    child.stderr.on("data", (data) => { stderr += data; });
    child.on("error", reject);
    child.stdin.on("error", (error: NodeJS.ErrnoException) => { if (error.code !== "EPIPE") reject(error); });
    child.on("close", (code) => resolve({ code, stdout, stderr }));
    child.stdin.end(stdin);
  });
}

beforeEach(async () => {
  inputDir = mkdtempSync(join(tmpdir(), "mb-file-input-"));
  requests = [];
  server = createServer((req, res) => {
    let body = "";
    req.on("data", (data) => { body += data; });
    req.on("end", () => {
      requests.push({ method: req.method, url: req.url, body: body ? JSON.parse(body) : null });
      res.setHeader("Content-Type", "application/json");
      if (req.url === "/api/card/42" && req.method === "GET") {
        res.end(JSON.stringify({
          id: 42, name: "Existing", display: "table", visualization_settings: {},
          parameters: [{ id: "region-param", slug: "region", type: "category", target: ["variable", ["template-tag", "region"]] }],
          dataset_query: { type: "native", database: 1, native: { query: "SELECT 1", "template-tags": {
            region: { id: "region-tag", name: "region", type: "text" },
          } } },
        }));
        return;
      }
      if (req.url === "/api/card" || (req.url === "/api/card/42" && req.method === "PUT")) {
        res.end(JSON.stringify({ id: 42, ...JSON.parse(body) }));
        return;
      }
      res.end(JSON.stringify({ data: { rows: [[1]], cols: [{ name: "id" }] } }));
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  host = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
});

describe("Card parameter file input", () => {
  it("resolves parameter and template-tag JSON from files and stdin", async () => {
    const values = { region: "中国 '$HOME' `literal`\n" };
    const path = join(inputDir, "params.json");
    writeFileSync(path, JSON.stringify(values));
    for (const flag of ["--params-file", "--template-tags-file"]) {
      for (const file of [path, "-"]) {
        const result = await runCli(["card", "run", "42", flag, file], JSON.stringify(values));
        expect(result.code, result.stderr).toBe(0);
      }
    }
    expect(requests.filter((request) => request.method === "POST").map((request) => request.body.parameters[0].value)).toEqual(Array(4).fill(values.region));
  });

  it("rejects invalid JSON and conflicting input consumers before fetching metadata", async () => {
    const invalid = join(inputDir, "bad-params.json");
    writeFileSync(invalid, "null");
    for (const [args, stdin] of [
      [["--params-file", invalid], ""],
      [["--template-tags-file", "-"], "[]"],
      [["--params-file", "-", "--template-tags-file", "-"], "{}"],
      [["--params", "{}", "--params-file", "-"], "{}"],
      [["--template-tags", "{}", "--template-tags-file", "-"], "{}"],
      [["--params-file", "-", "--template-tags", "{}"], "{}"],
    ] as [string[], string][]) {
      const result = await runCli(["card", "run", "42", ...args], stdin);
      expect(result.code, args.join(" ")).not.toBe(0);
      expect(result.stdout).toBe("");
      expect(result.stderr).toMatch(/cannot be combined|must be an object/);
    }
    expect(requests).toHaveLength(0);
  });
});

describe("Card SQL and payload file input", () => {
  it("accepts --db for create and rejects simultaneous database aliases", async () => {
    const created = await runCli(["card", "create", "--name", "Report", "--db", "7", "--sql", "SELECT 1"]);
    expect(created.code, created.stderr).toBe(0);
    expect(requests[0].body.dataset_query.database).toBe(7);
    for (const secondId of ["7", "8"]) {
      const invalid = await runCli(["card", "create", "--name", "Report", "--db", "7", "--database", secondId, "--sql", "SELECT 1"]);
      expect(invalid.code).not.toBe(0);
      expect(invalid.stderr).toMatch(/cannot be used with/);
    }
    expect(requests).toHaveLength(1);
  });

  it("creates and updates Cards from SQL files or stdin without changing literal text", async () => {
    const sql = "SELECT '$HOME', '`literal`'\nFROM orders;\n";
    const path = join(inputDir, "card.sql");
    writeFileSync(path, sql);
    for (const file of [path, "-"]) {
      const created = await runCli(["card", "create", "--name", "Report", "--database", "1", "--sql-file", file], sql);
      expect(created.code, created.stderr).toBe(0);
      expect(JSON.parse(created.stdout)[0].dataset_query.native.query).toBe(sql);
      const updated = await runCli(["card", "update", "42", "--sql-file", file], sql);
      expect(updated.code, updated.stderr).toBe(0);
      expect(JSON.parse(updated.stdout)[0].dataset_query.native.query).toBe(sql);
    }
    expect(requests.filter((request) => request.method !== "GET").map((request) => request.body.dataset_query.native.query)).toEqual([sql, sql, sql, sql]);
  });

  it("creates and patches Cards using JSON stdin", async () => {
    const payload = {
      name: "Imported", display: "table", visualization_settings: {},
      dataset_query: { type: "native", database: 1, native: { query: "SELECT '$HOME'" } },
    };
    const created = await runCli(["card", "create", "--from", "-"], JSON.stringify(payload));
    expect(created.code, created.stderr).toBe(0);
    expect(requests[0].body).toEqual(payload);
    const updated = await runCli(["card", "update", "42", "--from", "-"], JSON.stringify({ name: "Renamed" }));
    expect(updated.code, updated.stderr).toBe(0);
    expect(requests[2].body).toMatchObject({ name: "Renamed", dataset_query: { native: { query: "SELECT 1" } } });
  });

  it("rejects malformed payloads and multiple sources before even fetching a Card", async () => {
    const invalid = join(inputDir, "invalid.json");
    writeFileSync(invalid, "{");
    for (const [args, stdin] of [
      [["card", "create", "--from", "-"], "[]"],
      [["card", "update", "42", "--from", "-"], "{"],
      [["card", "update", "42", "--from", invalid], ""],
      [["card", "update", "42", "--sql", "SELECT 1", "--sql-file", "-"], "SELECT 2"],
      [["card", "update", "42", "--from", "-", "--sql-file", "-"], "{}"],
      [["card", "create", "--from", "-", "--sql-file", "-"], "{}"],
      [["card", "create", "--name", "Report", "--database", "1", "--sql", "SELECT 1", "--sql-file", "-"], "SELECT 2"],
    ] as [string[], string][]) {
      const result = await runCli(args, stdin);
      expect(result.code, args.join(" ")).not.toBe(0);
      expect(result.stdout).toBe("");
      expect(result.stderr).toMatch(/cannot be combined|must be an object|must contain valid JSON/);
    }
    expect(requests).toHaveLength(0);
  });
});

afterEach(async () => {
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  rmSync(inputDir, { recursive: true, force: true });
});

describe("query file and stdin input", () => {
  it("sends multiline SQL unchanged from a file and stdin", async () => {
    const sql = "SELECT '中文', '$HOME', '`literal`', 'a\\b'\nFROM orders;\n";
    const path = join(inputDir, "query.sql");
    writeFileSync(path, sql);
    for (const file of [path, "-"]) {
      const result = await runCli(["query", "--db", "1", "--file", file], sql);
      expect(result.code, result.stderr).toBe(0);
      expect(JSON.parse(result.stdout)[0].id).toBe(1);
    }
    expect(requests.map((r) => r.body.native.query)).toEqual([sql, sql]);
  });

  it("rejects conflicting, missing, empty, and unreadable SQL before requests", async () => {
    const empty = join(inputDir, "empty.sql");
    writeFileSync(empty, " \n");
    for (const args of [
      ["query", "SELECT 1", "--file", "-", "--db", "1"],
      ["query", "--db", "1"],
      ["query", "--file", "-", "--db", "1"],
      ["query", "--file", empty, "--db", "1"],
      ["query", "--file", join(inputDir, "missing.sql"), "--db", "1"],
    ]) {
      const result = await runCli(args);
      expect(result.code, args.join(" ")).not.toBe(0);
      expect(result.stdout).toBe("");
      expect(result.stderr).toMatch(/cannot be combined|required|must not be empty|Unable to read/);
    }
    expect(requests).toHaveLength(0);
  });
});
