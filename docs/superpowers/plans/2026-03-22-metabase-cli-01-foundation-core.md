# Metabase CLI (`mb`) Foundation and Core Runtime Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Tech Stack:** TypeScript 5, Node.js 18+, commander 12, vitest, pnpm

**Spec:** `docs/superpowers/specs/2026-03-22-metabase-cli-design.md`

**Goal:** Establish the TypeScript CLI skeleton and the reusable runtime modules that every later command plan depends on.

**Architecture:** Build the entry point, shared types, config loader, auth resolution, output formatter, and HTTP client first. Later command plans should only consume these primitives instead of duplicating transport, auth, or formatting logic.

**Dependencies:** None. This is the baseline plan that unblocks every other subplan.

**Covers Original Tasks:** 1, 2, 3, 4, 5

---

## Included Tasks
### Task 1: Project Scaffolding

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `.gitignore`
- Create: `src/index.ts`
- Create: `src/types/index.ts`

- [ ] **Step 1: Initialize git repo**

```bash
cd E:/ai-services/metabase-cli
git init
```

- [ ] **Step 2: Create package.json**

Create `package.json`:

```json
{
  "name": "metabase-cli",
  "version": "0.1.0",
  "description": "CLI tool for querying Metabase, designed for AI agents",
  "type": "module",
  "bin": {
    "mb": "./dist/index.js"
  },
  "scripts": {
    "dev": "tsx src/index.ts",
    "build": "tsc",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "engines": {
    "node": ">=18.0.0"
  },
  "license": "MIT"
}
```

- [ ] **Step 3: Create tsconfig.json**

Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

- [ ] **Step 4: Create .gitignore**

Create `.gitignore`:

```
node_modules/
dist/
*.tsbuildinfo
.env
```

- [ ] **Step 5: Create vitest.config.ts**

Create `vitest.config.ts`:

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
  },
});
```

- [ ] **Step 6: Install dependencies**

```bash
pnpm add commander yaml cli-table3 csv-stringify jmespath
pnpm add -D typescript tsx vitest @types/node @types/jmespath
```

- [ ] **Step 7: Create type definitions**

Create `src/types/index.ts`:

```typescript
export interface HostConfig {
  protocol: string;
  token: string;
  token_type: "api_key" | "session";
  username?: string;
  default_db?: number;
}

export interface Config {
  current_host?: string;
  hosts: Record<string, HostConfig>;
}

export interface GlobalOptions {
  host?: string;
  token?: string;
  format?: "json" | "csv" | "table";
  json?: string;
  jq?: string;
  omitHeader?: boolean;
}

export interface QueryResult {
  rows: any[][];
  cols: { name: string; display_name: string; base_type: string }[];
}

export interface PaginationInfo {
  total: number;
  offset: number;
  limit: number;
}

export interface ApiErrorResponse {
  message?: string;
  errors?: Record<string, string>;
}
```

- [ ] **Step 8: Create minimal entry point**

Create `src/index.ts`:

```typescript
#!/usr/bin/env node
import { Command } from "commander";

const program = new Command();

program
  .name("mb")
  .description("Metabase CLI — query data from the terminal")
  .version("0.1.0");

program.parse();
```

- [ ] **Step 9: Verify dev script runs**

Run: `pnpm dev -- --help`
Expected: Shows `mb` help with name, description, version.

- [ ] **Step 10: Verify build works**

Run: `pnpm build`
Expected: `dist/index.js` created without errors.

- [ ] **Step 11: Commit**

```bash
git add package.json pnpm-lock.yaml tsconfig.json vitest.config.ts .gitignore src/index.ts src/types/index.ts docs/
git commit -m "feat: scaffold metabase-cli project with types and entry point"
```

---

---

### Task 2: Config Module

**Files:**
- Create: `src/lib/config.ts`
- Create: `tests/lib/config.test.ts`

Config reads/writes `~/.config/mb/config.yml`, merges env vars, provides typed access. Priority: CLI flags > env vars > config file.

- [ ] **Step 1: Write tests for config module**

Create `tests/lib/config.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

// We'll mock HOME to use a temp dir
let testHome: string;

// Tests will import from the module after setting up mocks
describe("config", () => {
  beforeEach(() => {
    vi.resetModules();
    testHome = join(tmpdir(), `mb-test-${Date.now()}`);
    mkdirSync(testHome, { recursive: true });
    // Override HOME for config path resolution
    vi.stubEnv("HOME", testHome);
    vi.stubEnv("USERPROFILE", testHome);
    // Clear all MB_ env vars
    vi.stubEnv("MB_HOST", "");
    vi.stubEnv("MB_TOKEN", "");
    vi.stubEnv("MB_SESSION_TOKEN", "");
    vi.stubEnv("MB_USERNAME", "");
    vi.stubEnv("MB_PASSWORD", "");
    vi.stubEnv("MB_DEFAULT_DB", "");
    vi.stubEnv("MB_FORMAT", "");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns empty config when no config file exists", async () => {
    const { loadConfig } = await import("../../src/lib/config.js");
    const config = loadConfig();
    expect(config.hosts).toEqual({});
    expect(config.current_host).toBeUndefined();
  });

  it("reads config from YAML file", async () => {
    const configDir = join(testHome, ".config", "mb");
    mkdirSync(configDir, { recursive: true });
    writeFileSync(
      join(configDir, "config.yml"),
      `current_host: metabase.example.com
hosts:
  metabase.example.com:
    protocol: https
    token: mb_test123
    token_type: api_key
    default_db: 1
`
    );
    // Re-import to pick up new HOME
    const { loadConfig } = await import("../../src/lib/config.js");
    const config = loadConfig();
    expect(config.current_host).toBe("metabase.example.com");
    expect(config.hosts["metabase.example.com"].token).toBe("mb_test123");
    expect(config.hosts["metabase.example.com"].token_type).toBe("api_key");
  });

  it("saves config to YAML file", async () => {
    const { saveConfig, getConfigPath } = await import(
      "../../src/lib/config.js"
    );
    saveConfig({
      current_host: "test.example.com",
      hosts: {
        "test.example.com": {
          protocol: "https",
          token: "mb_abc",
          token_type: "api_key",
        },
      },
    });
    const configPath = getConfigPath();
    expect(existsSync(configPath)).toBe(true);
    const content = readFileSync(configPath, "utf-8");
    expect(content).toContain("test.example.com");
    expect(content).toContain("mb_abc");
  });

  it("resolves host from env var MB_HOST", async () => {
    vi.stubEnv("MB_HOST", "https://env.example.com");
    const { resolveHost } = await import("../../src/lib/config.js");
    const host = resolveHost({});
    expect(host).toBe("env.example.com");
  });

  it("resolves host from CLI flag over env var", async () => {
    vi.stubEnv("MB_HOST", "https://env.example.com");
    const { resolveHost } = await import("../../src/lib/config.js");
    const host = resolveHost({ host: "https://cli.example.com" });
    expect(host).toBe("cli.example.com");
  });

  it("resolves default_db from env var MB_DEFAULT_DB", async () => {
    vi.stubEnv("MB_DEFAULT_DB", "5");
    const { resolveDefaultDb } = await import("../../src/lib/config.js");
    expect(resolveDefaultDb({})).toBe(5);
  });

  it("resolves format from env var MB_FORMAT", async () => {
    vi.stubEnv("MB_FORMAT", "csv");
    const { resolveFormat } = await import("../../src/lib/config.js");
    expect(resolveFormat({})).toBe("csv");
  });

  it("CLI format flag overrides env var", async () => {
    vi.stubEnv("MB_FORMAT", "csv");
    const { resolveFormat } = await import("../../src/lib/config.js");
    expect(resolveFormat({ format: "table" })).toBe("table");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test -- tests/lib/config.test.ts`
Expected: FAIL — module `../../src/lib/config.js` not found.

- [ ] **Step 3: Implement config module**

Create `src/lib/config.ts`:

```typescript
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { homedir } from "node:os";
import { parse, stringify } from "yaml";
import type { Config, GlobalOptions } from "../types/index.js";

export function getConfigDir(): string {
  return join(homedir(), ".config", "mb");
}

export function getConfigPath(): string {
  return join(getConfigDir(), "config.yml");
}

export function loadConfig(): Config {
  const configPath = getConfigPath();
  if (!existsSync(configPath)) {
    return { hosts: {} };
  }
  const content = readFileSync(configPath, "utf-8");
  const parsed = parse(content);
  return {
    current_host: parsed?.current_host,
    hosts: parsed?.hosts ?? {},
  };
}

export function saveConfig(config: Config): void {
  const configPath = getConfigPath();
  const dir = dirname(configPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(configPath, stringify(config), "utf-8");
}

export function resolveHost(opts: GlobalOptions): string | undefined {
  const raw = opts.host || process.env.MB_HOST;
  if (!raw) {
    const config = loadConfig();
    return config.current_host;
  }
  // Strip protocol to get hostname
  try {
    return new URL(raw).hostname;
  } catch {
    return raw;
  }
}

export function resolveHostUrl(opts: GlobalOptions): string | undefined {
  const raw = opts.host || process.env.MB_HOST;
  if (raw) {
    // Ensure it has a protocol
    return raw.startsWith("http") ? raw : `https://${raw}`;
  }
  const config = loadConfig();
  const host = config.current_host;
  if (!host) return undefined;
  const hostConfig = config.hosts[host];
  const protocol = hostConfig?.protocol || "https";
  return `${protocol}://${host}`;
}

export function resolveDefaultDb(opts: GlobalOptions & { db?: number }): number | undefined {
  if (opts.db) return opts.db;
  const envDb = process.env.MB_DEFAULT_DB;
  if (envDb) return parseInt(envDb, 10);
  const config = loadConfig();
  const host = config.current_host;
  if (host && config.hosts[host]) {
    return config.hosts[host].default_db;
  }
  return undefined;
}

export function resolveFormat(opts: GlobalOptions): "json" | "csv" | "table" {
  if (opts.format) return opts.format;
  const envFormat = process.env.MB_FORMAT;
  if (envFormat && ["json", "csv", "table"].includes(envFormat)) {
    return envFormat as "json" | "csv" | "table";
  }
  return "json";
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test -- tests/lib/config.test.ts`
Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/config.ts tests/lib/config.test.ts
git commit -m "feat: add config module with YAML read/write and env var resolution"
```

---

---

### Task 3: Auth Module

**Files:**
- Create: `src/lib/auth.ts`
- Create: `tests/lib/auth.test.ts`

Token resolution priority: CLI `--token` > env `MB_TOKEN`/`MB_SESSION_TOKEN` > config file > env `MB_USERNAME`+`MB_PASSWORD` auto-login. Token type detection: config `token_type` > `mb_` prefix → API key > fallback session token.

- [ ] **Step 1: Write tests for auth module**

Create `tests/lib/auth.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

let testHome: string;

describe("auth", () => {
  beforeEach(() => {
    vi.resetModules();
    testHome = join(tmpdir(), `mb-auth-test-${Date.now()}`);
    mkdirSync(testHome, { recursive: true });
    vi.stubEnv("HOME", testHome);
    vi.stubEnv("USERPROFILE", testHome);
    vi.stubEnv("MB_HOST", "");
    vi.stubEnv("MB_TOKEN", "");
    vi.stubEnv("MB_SESSION_TOKEN", "");
    vi.stubEnv("MB_USERNAME", "");
    vi.stubEnv("MB_PASSWORD", "");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  describe("resolveToken", () => {
    it("returns CLI --token with highest priority", async () => {
      vi.stubEnv("MB_TOKEN", "mb_env_token");
      const { resolveToken } = await import("../../src/lib/auth.js");
      const result = resolveToken({ token: "mb_cli_token" });
      expect(result).toEqual({ token: "mb_cli_token", type: "api_key" });
    });

    it("detects API key from mb_ prefix", async () => {
      const { resolveToken } = await import("../../src/lib/auth.js");
      const result = resolveToken({ token: "mb_test123" });
      expect(result).toEqual({ token: "mb_test123", type: "api_key" });
    });

    it("reads MB_TOKEN env var", async () => {
      vi.stubEnv("MB_TOKEN", "mb_envkey");
      const { resolveToken } = await import("../../src/lib/auth.js");
      const result = resolveToken({});
      expect(result).toEqual({ token: "mb_envkey", type: "api_key" });
    });

    it("reads MB_SESSION_TOKEN as session type", async () => {
      vi.stubEnv("MB_SESSION_TOKEN", "sess_abc");
      const { resolveToken } = await import("../../src/lib/auth.js");
      const result = resolveToken({});
      expect(result).toEqual({ token: "sess_abc", type: "session" });
    });

    it("MB_TOKEN takes priority over MB_SESSION_TOKEN", async () => {
      vi.stubEnv("MB_TOKEN", "mb_api");
      vi.stubEnv("MB_SESSION_TOKEN", "sess_abc");
      const { resolveToken } = await import("../../src/lib/auth.js");
      const result = resolveToken({});
      expect(result).toEqual({ token: "mb_api", type: "api_key" });
    });

    it("reads token from config file", async () => {
      const configDir = join(testHome, ".config", "mb");
      mkdirSync(configDir, { recursive: true });
      writeFileSync(
        join(configDir, "config.yml"),
        `current_host: test.com
hosts:
  test.com:
    protocol: https
    token: mb_fromconfig
    token_type: api_key
`
      );
      const { resolveToken } = await import("../../src/lib/auth.js");
      const result = resolveToken({});
      expect(result).toEqual({ token: "mb_fromconfig", type: "api_key" });
    });

    it("returns null when no token available", async () => {
      const { resolveToken } = await import("../../src/lib/auth.js");
      const result = resolveToken({});
      expect(result).toBeNull();
    });
  });

  describe("getAuthHeader", () => {
    it("returns X-Api-Key header for api_key type", async () => {
      const { getAuthHeader } = await import("../../src/lib/auth.js");
      const header = getAuthHeader({ token: "mb_test", type: "api_key" });
      expect(header).toEqual({ "X-Api-Key": "mb_test" });
    });

    it("returns X-Metabase-Session header for session type", async () => {
      const { getAuthHeader } = await import("../../src/lib/auth.js");
      const header = getAuthHeader({ token: "sess_abc", type: "session" });
      expect(header).toEqual({ "X-Metabase-Session": "sess_abc" });
    });
  });

  describe("detectTokenType", () => {
    it("returns api_key for mb_ prefix", async () => {
      const { detectTokenType } = await import("../../src/lib/auth.js");
      expect(detectTokenType("mb_abc123")).toBe("api_key");
    });

    it("returns session for non-mb_ prefix", async () => {
      const { detectTokenType } = await import("../../src/lib/auth.js");
      expect(detectTokenType("some-uuid-token")).toBe("session");
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test -- tests/lib/auth.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement auth module**

Create `src/lib/auth.ts`:

```typescript
import { loadConfig, saveConfig } from "./config.js";
import type { GlobalOptions } from "../types/index.js";

export interface TokenInfo {
  token: string;
  type: "api_key" | "session";
}

export function detectTokenType(token: string): "api_key" | "session" {
  return token.startsWith("mb_") ? "api_key" : "session";
}

export function resolveToken(opts: GlobalOptions): TokenInfo | null {
  // Priority 1: CLI --token
  if (opts.token) {
    return { token: opts.token, type: detectTokenType(opts.token) };
  }

  // Priority 2: MB_TOKEN env var
  const envToken = process.env.MB_TOKEN;
  if (envToken) {
    return { token: envToken, type: detectTokenType(envToken) };
  }

  // Priority 2b: MB_SESSION_TOKEN env var
  const envSession = process.env.MB_SESSION_TOKEN;
  if (envSession) {
    return { token: envSession, type: "session" };
  }

  // Priority 3: Config file
  const config = loadConfig();
  const host = config.current_host;
  if (host && config.hosts[host]?.token) {
    const hostConfig = config.hosts[host];
    return {
      token: hostConfig.token,
      type: hostConfig.token_type || detectTokenType(hostConfig.token),
    };
  }

  return null;
}

export function getAuthHeader(
  tokenInfo: TokenInfo
): Record<string, string> {
  if (tokenInfo.type === "api_key") {
    return { "X-Api-Key": tokenInfo.token };
  }
  return { "X-Metabase-Session": tokenInfo.token };
}

export async function loginWithPassword(
  baseUrl: string,
  username: string,
  password: string
): Promise<string> {
  const res = await fetch(`${baseUrl}/api/session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(
      body.message || `Authentication failed (HTTP ${res.status})`
    );
  }
  const body = await res.json();
  return body.id; // session token
}

export function storeToken(
  host: string,
  protocol: string,
  token: string,
  tokenType: "api_key" | "session",
  username?: string
): void {
  const config = loadConfig();
  config.current_host = host;
  if (!config.hosts) config.hosts = {};
  config.hosts[host] = {
    ...config.hosts[host],
    protocol,
    token,
    token_type: tokenType,
  };
  if (username) {
    config.hosts[host].username = username;
  }
  saveConfig(config);
}

export function clearToken(host?: string): void {
  const config = loadConfig();
  const targetHost = host || config.current_host;
  if (targetHost && config.hosts[targetHost]) {
    delete config.hosts[targetHost];
    if (config.current_host === targetHost) {
      config.current_host = undefined;
    }
  }
  saveConfig(config);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test -- tests/lib/auth.test.ts`
Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth.ts tests/lib/auth.test.ts
git commit -m "feat: add auth module with token resolution, type detection, and login"
```

---

---

### Task 4: Formatter Module

**Files:**
- Create: `src/lib/formatter.ts`
- Create: `tests/lib/formatter.test.ts`

Transforms API responses into JSON/CSV/table output. Supports `--json` field selection, `--jq` (JMESPath), `--no-header`, pagination metadata to stderr.

- [ ] **Step 1: Write tests for formatter module**

Create `tests/lib/formatter.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import {
  formatJson,
  formatCsv,
  formatTable,
  applyJsonFieldSelection,
  applyJmesPath,
  formatPaginationInfo,
  formatQueryResult,
} from "../../src/lib/formatter.js";

const sampleRows = [
  [1, "Alice", "alice@example.com"],
  [2, "Bob", "bob@example.com"],
];
const sampleCols = [
  { name: "id", display_name: "ID", base_type: "type/Integer" },
  { name: "name", display_name: "Name", base_type: "type/Text" },
  { name: "email", display_name: "Email", base_type: "type/Text" },
];

describe("formatter", () => {
  describe("formatQueryResult", () => {
    it("converts rows+cols to array of objects", () => {
      const result = formatQueryResult(sampleRows, sampleCols);
      expect(result).toEqual([
        { id: 1, name: "Alice", email: "alice@example.com" },
        { id: 2, name: "Bob", email: "bob@example.com" },
      ]);
    });
  });

  describe("formatJson", () => {
    it("outputs JSON string", () => {
      const data = [{ id: 1, name: "Alice" }];
      const output = formatJson(data);
      expect(JSON.parse(output)).toEqual(data);
    });
  });

  describe("applyJsonFieldSelection", () => {
    it("selects specified fields", () => {
      const data = [
        { id: 1, name: "Alice", email: "alice@example.com" },
        { id: 2, name: "Bob", email: "bob@example.com" },
      ];
      const result = applyJsonFieldSelection(data, "id,name");
      expect(result).toEqual([
        { id: 1, name: "Alice" },
        { id: 2, name: "Bob" },
      ]);
    });
  });

  describe("applyJmesPath", () => {
    it("applies JMESPath expression", () => {
      const data = [
        { id: 1, name: "Alice" },
        { id: 2, name: "Bob" },
      ];
      const result = applyJmesPath(data, "[].name");
      expect(result).toEqual(["Alice", "Bob"]);
    });
  });

  describe("formatCsv", () => {
    it("outputs CSV with header", () => {
      const data = [
        { id: 1, name: "Alice" },
        { id: 2, name: "Bob" },
      ];
      const output = formatCsv(data);
      const lines = output.trim().split("\n");
      expect(lines[0]).toBe("id,name");
      expect(lines[1]).toBe("1,Alice");
      expect(lines[2]).toBe("2,Bob");
    });

    it("outputs CSV without header when omitHeader is true", () => {
      const data = [{ id: 1, name: "Alice" }];
      const output = formatCsv(data, true);
      const lines = output.trim().split("\n");
      expect(lines[0]).toBe("1,Alice");
    });
  });

  describe("formatTable", () => {
    it("outputs table with borders", () => {
      const data = [
        { id: 1, name: "Alice" },
        { id: 2, name: "Bob" },
      ];
      const output = formatTable(data);
      expect(output).toContain("id");
      expect(output).toContain("Alice");
      expect(output).toContain("Bob");
    });

    it("outputs table without header when omitHeader is true", () => {
      const data = [{ id: 1, name: "Alice" }];
      const output = formatTable(data, true);
      expect(output).toContain("Alice");
      // No header row "id" | "name" should appear
      expect(output).not.toContain("id");
    });
  });

  describe("formatPaginationInfo", () => {
    it("formats pagination metadata", () => {
      const msg = formatPaginationInfo({ total: 1523, offset: 0, limit: 100 });
      expect(msg).toContain("1-100");
      expect(msg).toContain("1523");
      expect(msg).toContain("--offset 100");
    });

    it("shows correct range for offset > 0", () => {
      const msg = formatPaginationInfo({ total: 500, offset: 100, limit: 100 });
      expect(msg).toContain("101-200");
    });

    it("returns empty string when all rows shown", () => {
      const msg = formatPaginationInfo({ total: 50, offset: 0, limit: 100 });
      expect(msg).toBe("");
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test -- tests/lib/formatter.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement formatter module**

Create `src/lib/formatter.ts`:

```typescript
import Table from "cli-table3";
import { stringify } from "csv-stringify/sync";
import jmespath from "jmespath";
import type { PaginationInfo } from "../types/index.js";

export function formatQueryResult(
  rows: any[][],
  cols: { name: string }[]
): Record<string, any>[] {
  return rows.map((row) => {
    const obj: Record<string, any> = {};
    cols.forEach((col, i) => {
      obj[col.name] = row[i];
    });
    return obj;
  });
}

export function formatJson(data: any): string {
  return JSON.stringify(data, null, 2);
}

export function applyJsonFieldSelection(
  data: Record<string, any>[],
  fields: string
): Record<string, any>[] {
  const fieldList = fields.split(",").map((f) => f.trim());
  return data.map((row) => {
    const obj: Record<string, any> = {};
    for (const f of fieldList) {
      if (f in row) obj[f] = row[f];
    }
    return obj;
  });
}

export function applyJmesPath(data: any, expr: string): any {
  return jmespath.search(data, expr);
}

export function formatCsv(
  data: Record<string, any>[],
  omitHeader = false
): string {
  if (data.length === 0) return "";
  const columns = Object.keys(data[0]);
  const rows = data.map((row) => columns.map((c) => row[c]));
  return stringify(omitHeader ? rows : [columns, ...rows]);
}

export function formatTable(
  data: Record<string, any>[],
  omitHeader = false
): string {
  if (data.length === 0) return "(no results)";
  const columns = Object.keys(data[0]);
  const table = new Table(
    omitHeader ? {} : { head: columns }
  );
  for (const row of data) {
    table.push(columns.map((c) => String(row[c] ?? "")));
  }
  return table.toString();
}

export function formatPaginationInfo(info: PaginationInfo): string {
  if (info.total <= info.limit && info.offset === 0) {
    return "";
  }
  const start = info.offset + 1;
  const end = Math.min(info.offset + info.limit, info.total);
  const nextOffset = info.offset + info.limit;
  let msg = `// Showing rows ${start}-${end} of ${info.total} returned by Metabase.`;
  if (nextOffset < info.total) {
    msg += `\n// Use --offset ${nextOffset} to see next page.`;
  }
  return msg;
}

/**
 * Main output function: applies field selection, jq, format, and writes to stdout/stderr.
 */
export function output(
  data: Record<string, any>[],
  opts: {
    format?: "json" | "csv" | "table";
    json?: string;
    jq?: string;
    omitHeader?: boolean;
    pagination?: PaginationInfo;
  }
): void {
  let processed: any = data;

  // Apply --json field selection
  if (opts.json && Array.isArray(processed)) {
    processed = applyJsonFieldSelection(processed, opts.json);
  }

  // Apply --jq (JMESPath)
  if (opts.jq) {
    processed = applyJmesPath(processed, opts.jq);
    // After jq, always output as JSON regardless of format
    process.stdout.write(formatJson(processed) + "\n");
  } else {
    const format = opts.format || "json";
    switch (format) {
      case "csv":
        process.stdout.write(formatCsv(processed, opts.omitHeader));
        break;
      case "table":
        process.stdout.write(formatTable(processed, opts.omitHeader) + "\n");
        break;
      case "json":
      default:
        process.stdout.write(formatJson(processed) + "\n");
        break;
    }
  }

  // Pagination to stderr
  if (opts.pagination) {
    const paginationMsg = formatPaginationInfo(opts.pagination);
    if (paginationMsg) {
      process.stderr.write(paginationMsg + "\n");
    }
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test -- tests/lib/formatter.test.ts`
Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/formatter.ts tests/lib/formatter.test.ts
git commit -m "feat: add formatter module with json/csv/table output and jmespath filtering"
```

---

---

### Task 5: API Client Module

**Files:**
- Create: `src/lib/api-client.ts`
- Create: `tests/lib/api-client.test.ts`
- Create: `tests/helpers/mock-server.ts`

Central HTTP client with auth header injection, 401 auto-renewal, and unified error handling. All Metabase API calls go through this module.

- [ ] **Step 1: Create mock server helper**

Create `tests/helpers/mock-server.ts`:

```typescript
import { vi } from "vitest";

interface MockResponse {
  status: number;
  body: any;
  headers?: Record<string, string>;
}

let mockResponses: MockResponse[] = [];
let fetchCalls: { url: string; init?: RequestInit }[] = [];

export function mockFetch(responses: MockResponse[]) {
  mockResponses = [...responses];
  fetchCalls = [];

  const mockFn = vi.fn(async (url: string, init?: RequestInit) => {
    fetchCalls.push({ url, init });
    const response = mockResponses.shift();
    if (!response) {
      throw new Error(`No mock response for ${url}`);
    }
    return {
      ok: response.status >= 200 && response.status < 300,
      status: response.status,
      statusText: response.status === 200 ? "OK" : "Error",
      json: async () => response.body,
      text: async () => JSON.stringify(response.body),
      headers: new Headers(response.headers || {}),
    } as Response;
  });

  vi.stubGlobal("fetch", mockFn);
  return mockFn;
}

export function getFetchCalls() {
  return fetchCalls;
}

export function resetMock() {
  mockResponses = [];
  fetchCalls = [];
  vi.unstubAllGlobals();
}
```

- [ ] **Step 2: Write tests for api-client**

Create `tests/lib/api-client.test.ts`:

```typescript
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
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `pnpm test -- tests/lib/api-client.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement api-client module**

Create `src/lib/api-client.ts`:

```typescript
import {
  resolveToken,
  getAuthHeader,
  loginWithPassword,
  storeToken,
  type TokenInfo,
} from "./auth.js";
import { resolveHostUrl, resolveHost } from "./config.js";
import type { GlobalOptions } from "../types/index.js";

export class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export interface ApiClient {
  get(path: string, params?: Record<string, string>): Promise<any>;
  post(path: string, body?: any): Promise<any>;
  delete(path: string): Promise<any>;
}

export function createApiClient(opts: GlobalOptions): ApiClient {
  const baseUrl = resolveHostUrl(opts);
  if (!baseUrl) {
    throw new ApiError(0, "No Metabase host configured. Set MB_HOST or run 'mb auth login'.");
  }

  async function request(
    method: string,
    path: string,
    body?: any,
    isRetry = false
  ): Promise<any> {
    const tokenInfo = resolveToken(opts);
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (tokenInfo) {
      Object.assign(headers, getAuthHeader(tokenInfo));
    }

    const url = path.includes("?")
      ? `${baseUrl}${path}`
      : `${baseUrl}${path}`;

    const res = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (res.status === 401 && !isRetry) {
      // Try auto-renewal
      const username = process.env.MB_USERNAME;
      const password = process.env.MB_PASSWORD;
      if (username && password) {
        const newToken = await loginWithPassword(baseUrl, username, password);
        const host = resolveHost(opts);
        if (host) {
          const protocol = new URL(baseUrl).protocol.replace(":", "");
          storeToken(host, protocol, newToken, "session", username);
        }
        // Retry with new token — force it via opts override
        const retryOpts = { ...opts, token: newToken };
        const retryTokenInfo: TokenInfo = { token: newToken, type: "session" };
        const retryHeaders: Record<string, string> = {
          "Content-Type": "application/json",
          ...getAuthHeader(retryTokenInfo),
        };
        const retryRes = await fetch(url, {
          method,
          headers: retryHeaders,
          body: body ? JSON.stringify(body) : undefined,
        });
        if (!retryRes.ok) {
          const retryBody = await retryRes.json().catch(() => ({}));
          throw new ApiError(
            retryRes.status,
            retryBody.message || `HTTP ${retryRes.status}`
          );
        }
        return retryRes.json();
      }
      throw new ApiError(
        401,
        "Not authenticated. Run 'mb auth login' first."
      );
    }

    if (!res.ok) {
      const errorBody = await res.json().catch(() => ({}));
      throw new ApiError(
        res.status,
        errorBody.message || `HTTP ${res.status}`
      );
    }

    return res.json();
  }

  return {
    get(path: string, params?: Record<string, string>) {
      let url = path;
      if (params) {
        const qs = new URLSearchParams(params).toString();
        url = `${path}?${qs}`;
      }
      return request("GET", url);
    },
    post(path: string, body?: any) {
      return request("POST", path, body);
    },
    delete(path: string) {
      return request("DELETE", path);
    },
  };
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm test -- tests/lib/api-client.test.ts`
Expected: All tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/api-client.ts tests/lib/api-client.test.ts tests/helpers/mock-server.ts
git commit -m "feat: add api-client with auth injection, 401 auto-renewal, and error handling"
```

---

