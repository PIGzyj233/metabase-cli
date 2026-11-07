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
      res.end(JSON.stringify({ data: { rows: [[1]], cols: [{ name: "id" }] } }));
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  host = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
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
