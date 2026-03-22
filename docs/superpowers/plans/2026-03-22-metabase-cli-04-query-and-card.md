# Metabase CLI (`mb`) Query and Card Execution Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Tech Stack:** TypeScript 5, Node.js 18+, commander 12, vitest, pnpm

**Spec:** `docs/superpowers/specs/2026-03-22-metabase-cli-design.md`

**Goal:** Implement native SQL execution plus saved Card list/view/run flows, including parameter resolution and paginated output.

**Architecture:** Build query execution and Card execution on top of the same formatter and API client so result handling stays consistent. Keep query and card behavior together because both paths return tabular result sets and share pagination, output, and parameter-shaping concerns.

**Dependencies:** Requires Plan 01 (`2026-03-22-metabase-cli-01-foundation-core.md`). Plan 02 is recommended before full end-to-end validation, but not required for command implementation.

**Covers Original Tasks:** 8, 9

---

## Included Tasks
### Task 8: Query Command

**Files:**
- Create: `src/commands/query.ts`
- Modify: `src/index.ts` — register query command
- Create: `tests/commands/query.test.ts`

Core command: `mb query "<sql>" --db <id>`. Sends native SQL to `POST /api/dataset`, applies client-side pagination (`--limit`/`--offset`), outputs via formatter.

- [ ] **Step 1: Write tests for query command**

Create `tests/commands/query.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test -- tests/commands/query.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement query command**

Create `src/commands/query.ts`:

```typescript
import { Command } from "commander";
import { createApiClient } from "../lib/api-client.js";
import { formatQueryResult, output } from "../lib/formatter.js";
import { resolveDefaultDb, resolveFormat } from "../lib/config.js";
import type { GlobalOptions, PaginationInfo } from "../types/index.js";

interface QueryOptions extends GlobalOptions {
  db?: number;
  limit?: number;
  offset?: number;
}

interface QueryHandleResult {
  data: Record<string, any>[];
  pagination: PaginationInfo;
}

export async function handleQuery(
  sql: string,
  opts: QueryOptions
): Promise<QueryHandleResult> {
  const dbId = opts.db || resolveDefaultDb(opts);
  if (!dbId) {
    throw new Error("Database ID required. Use --db <id> or set MB_DEFAULT_DB.");
  }

  const client = createApiClient(opts);
  const res = await client.post("/api/dataset", {
    database: dbId,
    type: "native",
    native: { query: sql },
  });

  const rows = res.data?.rows || [];
  const cols = res.data?.cols || [];
  const allData = formatQueryResult(rows, cols);

  // Client-side pagination
  const limit = opts.limit ?? 100;
  const offset = opts.offset ?? 0;
  const paginatedData = allData.slice(offset, offset + limit);

  return {
    data: paginatedData,
    pagination: {
      total: allData.length,
      offset,
      limit,
    },
  };
}

export function registerQueryCommand(program: Command): void {
  program
    .command("query <sql>")
    .description("Execute a native SQL query")
    .option("--db <id>", "Database ID (or set MB_DEFAULT_DB)", (v) => parseInt(v))
    .option("--limit <n>", "Max rows to return (default: 100)", (v) => parseInt(v), 100)
    .option("--offset <n>", "Row offset for pagination", (v) => parseInt(v), 0)
    .action(async function (this: Command, sql: string) {
      const opts = this.optsWithGlobals();
      try {
        const result = await handleQuery(sql, opts);
        output(result.data, {
          ...opts,
          format: resolveFormat(opts),
          pagination: result.pagination,
        });
      } catch (e: any) {
        process.stderr.write(`Error: ${e.message}\n`);
        process.exit(1);
      }
    });
}
```

- [ ] **Step 4: Register in index.ts**

Add to `src/index.ts`:

```typescript
import { registerQueryCommand } from "./commands/query.js";

// Query command
registerQueryCommand(program);
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm test -- tests/commands/query.test.ts`
Expected: All tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/commands/query.ts tests/commands/query.test.ts src/index.ts
git commit -m "feat: add query command with native SQL execution and client-side pagination"
```

---

---

### Task 9: Card Commands (list / view / run)

**Files:**
- Create: `src/commands/card/list.ts`
- Create: `src/commands/card/view.ts`
- Create: `src/commands/card/run.ts`
- Modify: `src/index.ts` — register card subcommands
- Create: `tests/commands/card.test.ts`

Includes parameter resolution: `--params '{"key":"value"}'` → fetch card def → match by slug/name → construct Metabase parameter array.

- [ ] **Step 1: Write tests for card commands**

Create `tests/commands/card.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { mockFetch, resetMock, getFetchCalls } from "../helpers/mock-server.js";

let testHome: string;

describe("card commands", () => {
  beforeEach(() => {
    vi.resetModules();
    testHome = join(tmpdir(), `mb-card-test-${Date.now()}`);
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

  describe("card list", () => {
    it("lists all cards", async () => {
      mockFetch([{
        status: 200,
        body: [
          { id: 1, name: "Revenue Report", collection_id: 5 },
          { id: 2, name: "User Growth", collection_id: 5 },
        ],
      }]);
      const { handleCardList } = await import("../../src/commands/card/list.js");
      const result = await handleCardList({});
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe("Revenue Report");
    });

    it("lists cards in specific collection", async () => {
      mockFetch([{
        status: 200,
        body: {
          data: [
            { id: 1, name: "Revenue Report", model: "card" },
          ],
        },
      }]);
      const { handleCardList } = await import("../../src/commands/card/list.js");
      const result = await handleCardList({ collection: 5 });
      expect(result).toHaveLength(1);
    });
  });

  describe("card view", () => {
    it("returns card definition", async () => {
      mockFetch([{
        status: 200,
        body: {
          id: 42,
          name: "Revenue Report",
          description: "Monthly revenue",
          dataset_query: { type: "native", native: { query: "SELECT sum(amount) FROM orders" } },
          parameters: [
            { id: "p1", slug: "start_date", name: "Start Date", type: "date/single" },
          ],
        },
      }]);
      const { handleCardView } = await import("../../src/commands/card/view.js");
      const result = await handleCardView(42, {});
      expect(result.name).toBe("Revenue Report");
      expect(result.parameters).toHaveLength(1);
      expect(result.parameters[0].slug).toBe("start_date");
    });
  });

  describe("card run", () => {
    it("executes card without params", async () => {
      mockFetch([{
        status: 200,
        body: {
          data: {
            rows: [[100000]],
            cols: [{ name: "total", display_name: "Total", base_type: "type/Integer" }],
          },
        },
      }]);
      const { handleCardRun } = await import("../../src/commands/card/run.js");
      const result = await handleCardRun(42, {});
      expect(result.data).toEqual([{ total: 100000 }]);
    });

    it("resolves params by slug and sends correct format", async () => {
      // First call: GET /api/card/42 to get parameter definitions
      // Second call: POST /api/card/42/query with resolved parameters
      mockFetch([
        {
          status: 200,
          body: {
            id: 42,
            parameters: [
              {
                id: "abc-123",
                slug: "start_date",
                name: "Start Date",
                type: "date/single",
                target: ["variable", ["template-tag", "start_date"]],
              },
            ],
          },
        },
        {
          status: 200,
          body: {
            data: {
              rows: [[50000]],
              cols: [{ name: "total", display_name: "Total", base_type: "type/Integer" }],
            },
          },
        },
      ]);
      const { handleCardRun } = await import("../../src/commands/card/run.js");
      const result = await handleCardRun(42, {
        params: '{"start_date": "2024-01-01"}',
      });
      expect(result.data).toEqual([{ total: 50000 }]);

      // Verify the POST body has resolved parameters
      const calls = getFetchCalls();
      expect(calls).toHaveLength(2);
      const postBody = JSON.parse(calls[1].init?.body as string);
      expect(postBody.parameters).toEqual([
        {
          id: "abc-123",
          type: "date/single",
          target: ["variable", ["template-tag", "start_date"]],
          value: "2024-01-01",
        },
      ]);
    });

    it("throws error for unknown parameter key", async () => {
      mockFetch([
        {
          status: 200,
          body: {
            id: 42,
            parameters: [
              { id: "abc-123", slug: "start_date", name: "Start Date", type: "date/single" },
            ],
          },
        },
      ]);
      const { handleCardRun } = await import("../../src/commands/card/run.js");
      await expect(
        handleCardRun(42, { params: '{"unknown_key": "value"}' })
      ).rejects.toThrow(/unknown_key/);
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test -- tests/commands/card.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement card list**

Create `src/commands/card/list.ts`:

```typescript
import { Command } from "commander";
import { createApiClient } from "../../lib/api-client.js";
import { output } from "../../lib/formatter.js";
import type { GlobalOptions } from "../../types/index.js";

export async function handleCardList(
  opts: GlobalOptions & { collection?: number }
): Promise<any[]> {
  const client = createApiClient(opts);

  if (opts.collection) {
    // Use collection items endpoint filtered to cards
    const res = await client.get(
      `/api/collection/${opts.collection}/items`,
      { models: "card" }
    );
    return res.data || res;
  }

  return client.get("/api/card");
}

export function registerCardListCommand(parent: Command): void {
  parent
    .command("list")
    .description("List saved cards/questions")
    .option("--collection <id>", "Filter by collection", (v) => parseInt(v))
    .action(async function (this: Command) {
      const opts = this.optsWithGlobals();
      try {
        const cards = await handleCardList(opts);
        const simplified = cards.map((c: any) => ({
          id: c.id,
          name: c.name,
          collection_id: c.collection_id,
        }));
        output(simplified, opts);
      } catch (e: any) {
        process.stderr.write(`Error: ${e.message}\n`);
        process.exit(1);
      }
    });
}
```

- [ ] **Step 4: Implement card view**

Create `src/commands/card/view.ts`:

```typescript
import { Command } from "commander";
import { createApiClient } from "../../lib/api-client.js";
import { formatJson } from "../../lib/formatter.js";
import type { GlobalOptions } from "../../types/index.js";

export async function handleCardView(cardId: number, opts: GlobalOptions): Promise<any> {
  const client = createApiClient(opts);
  return client.get(`/api/card/${cardId}`);
}

export function registerCardViewCommand(parent: Command): void {
  parent
    .command("view <card-id>")
    .description("View card definition, query, and parameters")
    .action(async function (this: Command, cardId: string) {
      const opts = this.optsWithGlobals();
      try {
        const card = await handleCardView(parseInt(cardId), opts);
        // Show relevant fields for AI agents
        const summary = {
          id: card.id,
          name: card.name,
          description: card.description,
          query_type: card.dataset_query?.type,
          query: card.dataset_query?.native?.query || card.dataset_query,
          parameters: (card.parameters || []).map((p: any) => ({
            slug: p.slug,
            name: p.name,
            type: p.type,
          })),
        };
        process.stdout.write(formatJson(summary) + "\n");
      } catch (e: any) {
        process.stderr.write(`Error: ${e.message}\n`);
        process.exit(1);
      }
    });
}
```

- [ ] **Step 5: Implement card run with parameter resolution**

Create `src/commands/card/run.ts`:

```typescript
import { Command } from "commander";
import { createApiClient } from "../../lib/api-client.js";
import { formatQueryResult, output } from "../../lib/formatter.js";
import { resolveFormat } from "../../lib/config.js";
import type { GlobalOptions, PaginationInfo } from "../../types/index.js";

interface CardRunOptions extends GlobalOptions {
  params?: string;
  limit?: number;
  offset?: number;
}

interface CardRunResult {
  data: Record<string, any>[];
  pagination: PaginationInfo;
}

async function resolveParameters(
  client: ReturnType<typeof createApiClient>,
  cardId: number,
  paramsJson: string
): Promise<any[]> {
  const userParams = JSON.parse(paramsJson);
  const card = await client.get(`/api/card/${cardId}`);
  const cardParams: any[] = card.parameters || [];

  const resolved: any[] = [];
  for (const [key, value] of Object.entries(userParams)) {
    const match = cardParams.find(
      (p: any) => p.slug === key || p.name === key
    );
    if (!match) {
      const available = cardParams.map((p: any) => p.slug || p.name).join(", ");
      throw new Error(
        `Unknown parameter "${key}". Available parameters: ${available || "(none)"}`
      );
    }
    resolved.push({
      id: match.id,
      type: match.type,
      target: match.target,
      value,
    });
  }

  return resolved;
}

export async function handleCardRun(
  cardId: number,
  opts: CardRunOptions
): Promise<CardRunResult> {
  const client = createApiClient(opts);

  let body: any = { ignore_cache: false };
  if (opts.params) {
    body.parameters = await resolveParameters(client, cardId, opts.params);
  }

  const res = await client.post(`/api/card/${cardId}/query`, body);
  const rows = res.data?.rows || [];
  const cols = res.data?.cols || [];
  const allData = formatQueryResult(rows, cols);

  const limit = opts.limit ?? 100;
  const offset = opts.offset ?? 0;
  const paginatedData = allData.slice(offset, offset + limit);

  return {
    data: paginatedData,
    pagination: { total: allData.length, offset, limit },
  };
}

export function registerCardRunCommand(parent: Command): void {
  parent
    .command("run <card-id>")
    .description("Execute a saved card/question")
    .option("--params <json>", "Parameters as JSON key-value pairs")
    .option("--limit <n>", "Max rows (default: 100)", (v) => parseInt(v), 100)
    .option("--offset <n>", "Row offset", (v) => parseInt(v), 0)
    .action(async function (this: Command, cardId: string) {
      const opts = this.optsWithGlobals();
      try {
        const result = await handleCardRun(parseInt(cardId), opts);
        output(result.data, {
          ...opts,
          format: resolveFormat(opts),
          pagination: result.pagination,
        });
      } catch (e: any) {
        process.stderr.write(`Error: ${e.message}\n`);
        process.exit(1);
      }
    });
}
```

- [ ] **Step 6: Register card commands in index.ts**

Add to `src/index.ts`:

```typescript
import { registerCardListCommand } from "./commands/card/list.js";
import { registerCardViewCommand } from "./commands/card/view.js";
import { registerCardRunCommand } from "./commands/card/run.js";

// Card commands
const cardCmd = program.command("card").description("Saved cards/questions");
registerCardListCommand(cardCmd);
registerCardViewCommand(cardCmd);
registerCardRunCommand(cardCmd);
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `pnpm test -- tests/commands/card.test.ts`
Expected: All tests PASS.

- [ ] **Step 8: Commit**

```bash
git add src/commands/card/ tests/commands/card.test.ts src/index.ts
git commit -m "feat: add card commands (list, view, run) with parameter resolution"
```

---

