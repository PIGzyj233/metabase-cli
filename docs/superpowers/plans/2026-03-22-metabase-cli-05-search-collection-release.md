# Metabase CLI (`mb`) Search, Collection, and Release Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Tech Stack:** TypeScript 5, Node.js 18+, commander 12, vitest, pnpm

**Spec:** `docs/superpowers/specs/2026-03-22-metabase-cli-design.md`

**Goal:** Implement discovery commands (`search`, `collection`) and then close the loop with final integration, build verification, and skill packaging.

**Architecture:** Treat discovery features as the last user-facing command slice after the shared runtime exists. Hold the release-readiness checks and `skill.md` packaging in the same plan because they are only meaningful once the feature surface from the earlier subplans is present.

**Dependencies:** Task 10 requires Plan 01. Task 11 should run only after Plans 01-04 are complete and Task 10 is merged.

**Covers Original Tasks:** 10, 11

---

## Included Tasks
### Task 10: Search and Collection Commands

**Files:**
- Create: `src/commands/search.ts`
- Create: `src/commands/collection/list.ts`
- Create: `src/commands/collection/view.ts`
- Modify: `src/index.ts` — register search + collection
- Create: `tests/commands/search.test.ts`
- Create: `tests/commands/collection.test.ts`

- [ ] **Step 1: Write tests for search command**

Create `tests/commands/search.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { mockFetch, resetMock, getFetchCalls } from "../helpers/mock-server.js";

let testHome: string;

describe("search command", () => {
  beforeEach(() => {
    vi.resetModules();
    testHome = join(tmpdir(), `mb-search-test-${Date.now()}`);
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

  it("searches with query string", async () => {
    mockFetch([{
      status: 200,
      body: {
        data: [
          { id: 1, name: "Monthly Revenue", model: "card" },
          { id: 5, name: "Revenue Dashboard", model: "dashboard" },
        ],
      },
    }]);
    const { handleSearch } = await import("../../src/commands/search.js");
    const result = await handleSearch("revenue", {});
    expect(result).toHaveLength(2);
    const calls = getFetchCalls();
    expect(calls[0].url).toContain("q=revenue");
  });

  it("filters by type", async () => {
    mockFetch([{
      status: 200,
      body: {
        data: [{ id: 1, name: "Monthly Revenue", model: "card" }],
      },
    }]);
    const { handleSearch } = await import("../../src/commands/search.js");
    const result = await handleSearch("revenue", { type: "card" });
    expect(result).toHaveLength(1);
    const calls = getFetchCalls();
    expect(calls[0].url).toContain("models=card");
  });
});
```

- [ ] **Step 2: Write tests for collection commands**

Create `tests/commands/collection.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { mockFetch, resetMock } from "../helpers/mock-server.js";

let testHome: string;

describe("collection commands", () => {
  beforeEach(() => {
    vi.resetModules();
    testHome = join(tmpdir(), `mb-coll-test-${Date.now()}`);
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

  describe("collection list", () => {
    it("lists root collections", async () => {
      mockFetch([{
        status: 200,
        body: [
          { id: 1, name: "Our analytics", location: "/" },
          { id: 2, name: "Marketing", location: "/" },
        ],
      }]);
      const { handleCollectionList } = await import(
        "../../src/commands/collection/list.js"
      );
      const result = await handleCollectionList({});
      expect(result).toHaveLength(2);
    });
  });

  describe("collection view", () => {
    it("lists items in a collection", async () => {
      mockFetch([{
        status: 200,
        body: {
          data: [
            { id: 1, name: "Revenue Report", model: "card" },
            { id: 3, name: "Sub Collection", model: "collection" },
          ],
        },
      }]);
      const { handleCollectionView } = await import(
        "../../src/commands/collection/view.js"
      );
      const result = await handleCollectionView(1, {});
      expect(result).toHaveLength(2);
    });
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `pnpm test -- tests/commands/search.test.ts tests/commands/collection.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 4: Implement search command**

Create `src/commands/search.ts`:

```typescript
import { Command } from "commander";
import { createApiClient } from "../lib/api-client.js";
import { output } from "../lib/formatter.js";
import type { GlobalOptions } from "../types/index.js";

export async function handleSearch(
  query: string,
  opts: GlobalOptions & { type?: string }
): Promise<any[]> {
  const client = createApiClient(opts);
  const params: Record<string, string> = { q: query };
  if (opts.type) {
    params.models = opts.type;
  }
  const res = await client.get("/api/search", params);
  return res.data || res;
}

export function registerSearchCommand(program: Command): void {
  program
    .command("search <query>")
    .description("Search cards, dashboards, collections, and tables")
    .option("--type <type>", "Filter: card, dashboard, collection, table")
    .action(async function (this: Command, query: string) {
      const opts = this.optsWithGlobals();
      try {
        const results = await handleSearch(query, opts);
        const simplified = results.map((r: any) => ({
          id: r.id,
          name: r.name,
          model: r.model,
          collection_id: r.collection_id,
        }));
        output(simplified, opts);
      } catch (e: any) {
        process.stderr.write(`Error: ${e.message}\n`);
        process.exit(1);
      }
    });
}
```

- [ ] **Step 5: Implement collection list**

Create `src/commands/collection/list.ts`:

```typescript
import { Command } from "commander";
import { createApiClient } from "../../lib/api-client.js";
import { output } from "../../lib/formatter.js";
import type { GlobalOptions } from "../../types/index.js";

export async function handleCollectionList(
  opts: GlobalOptions & { parent?: number }
): Promise<any[]> {
  const client = createApiClient(opts);
  const collections = await client.get("/api/collection");

  if (opts.parent) {
    return collections.filter(
      (c: any) => c.location === `/${opts.parent}/` || c.parent_id === opts.parent
    );
  }
  return collections;
}

export function registerCollectionListCommand(parent: Command): void {
  parent
    .command("list")
    .description("List collections")
    .option("--parent <id>", "Filter by parent collection", (v) => parseInt(v))
    .action(async function (this: Command) {
      const opts = this.optsWithGlobals();
      try {
        const collections = await handleCollectionList(opts);
        const simplified = collections.map((c: any) => ({
          id: c.id,
          name: c.name,
          location: c.location,
        }));
        output(simplified, opts);
      } catch (e: any) {
        process.stderr.write(`Error: ${e.message}\n`);
        process.exit(1);
      }
    });
}
```

- [ ] **Step 6: Implement collection view**

Create `src/commands/collection/view.ts`:

```typescript
import { Command } from "commander";
import { createApiClient } from "../../lib/api-client.js";
import { output } from "../../lib/formatter.js";
import type { GlobalOptions } from "../../types/index.js";

export async function handleCollectionView(
  collectionId: number,
  opts: GlobalOptions
): Promise<any[]> {
  const client = createApiClient(opts);
  const res = await client.get(`/api/collection/${collectionId}/items`);
  return res.data || res;
}

export function registerCollectionViewCommand(parent: Command): void {
  parent
    .command("view <collection-id>")
    .description("View collection contents")
    .action(async function (this: Command, collectionId: string) {
      const opts = this.optsWithGlobals();
      try {
        const items = await handleCollectionView(parseInt(collectionId), opts);
        const simplified = items.map((i: any) => ({
          id: i.id,
          name: i.name,
          model: i.model,
        }));
        output(simplified, opts);
      } catch (e: any) {
        process.stderr.write(`Error: ${e.message}\n`);
        process.exit(1);
      }
    });
}
```

- [ ] **Step 7: Register in index.ts**

Add to `src/index.ts`:

```typescript
import { registerSearchCommand } from "./commands/search.js";
import { registerCollectionListCommand } from "./commands/collection/list.js";
import { registerCollectionViewCommand } from "./commands/collection/view.js";

// Search command
registerSearchCommand(program);

// Collection commands
const collectionCmd = program.command("collection").description("Browse collections");
registerCollectionListCommand(collectionCmd);
registerCollectionViewCommand(collectionCmd);
```

- [ ] **Step 8: Run all tests**

Run: `pnpm test`
Expected: All tests PASS.

- [ ] **Step 9: Commit**

```bash
git add src/commands/search.ts src/commands/collection/ tests/commands/search.test.ts tests/commands/collection.test.ts src/index.ts
git commit -m "feat: add search and collection commands"
```

---

---

### Task 11: Final Integration, Build Verification, and Skill File

**Files:**
- Modify: `src/index.ts` — verify complete command registration
- Verify: `pnpm build` produces working `dist/`
- Create: `skill.md` — skill file for AI agent consumption

This task verifies everything works end-to-end: build, global flags, help output, and creates the skill distribution file.

- [ ] **Step 1: Verify complete index.ts**

Read `src/index.ts` and confirm all commands are registered:
- `auth` (login, logout, status)
- `db` (list, schemas, tables, fields, metadata)
- `query`
- `card` (list, view, run)
- `search`
- `collection` (list, view)

And global options are set:
- `--host`, `--token`, `--format`, `--json`, `--jq`, `--no-header`

- [ ] **Step 2: Run full test suite**

Run: `pnpm test`
Expected: All tests across all modules PASS.

- [ ] **Step 3: Build and verify**

Run: `pnpm build`
Expected: `dist/` directory created with all compiled JS files, no errors.

Run: `node dist/index.js --help`
Expected: Shows all commands and global options.

Run: `node dist/index.js db --help`
Expected: Shows db subcommands.

Run: `node dist/index.js query --help`
Expected: Shows query options including --db, --limit, --offset.

- [ ] **Step 4: Create skill file**

Create `skill.md` in project root:

```markdown
---
name: metabase
description: Query data from Metabase databases. Use when the user needs to query business databases, run SQL, view saved reports, or explore database structure via Metabase.
---

# Metabase CLI (`mb`)

Query Metabase databases from the terminal. Designed for AI agent use.

## Prerequisites

Set environment variables before using:
- `MB_HOST` — Metabase server URL (e.g., `https://metabase.example.com`)
- `MB_TOKEN` — API key (starts with `mb_`), OR
- `MB_USERNAME` + `MB_PASSWORD` — for session-based auth with auto-renewal

Or run `mb auth login --host <url> --token <api-key>` to configure.

## Commands

### Authentication
| Command | Description |
|---------|-------------|
| `mb auth login --host <url> --token <key>` | Login with API key |
| `mb auth login --host <url> --username <u> --password <p>` | Login with password |
| `mb auth status` | Show current auth state |
| `mb auth logout` | Clear credentials |

### Database Exploration
| Command | Description |
|---------|-------------|
| `mb db list` | List all databases |
| `mb db schemas <db-id>` | List schemas in a database |
| `mb db tables <db-id> [--schema <name>]` | List tables |
| `mb db fields <table-id>` | List table fields (name, type, description) |
| `mb db metadata <db-id>` | Full database metadata |

### Query Execution
| Command | Description |
|---------|-------------|
| `mb query "<sql>" --db <id>` | Execute native SQL |
| `mb card list [--collection <id>]` | List saved cards |
| `mb card view <card-id>` | View card definition and parameters |
| `mb card run <card-id> [--params '{"key":"val"}']` | Run saved card |

### Search & Browse
| Command | Description |
|---------|-------------|
| `mb search <query> [--type card\|dashboard\|collection\|table]` | Search Metabase |
| `mb collection list [--parent <id>]` | List collections |
| `mb collection view <id>` | View collection contents |

### Global Flags
All commands support: `--format json|csv|table` (default: json), `--json <fields>`, `--jq <jmespath-expr>`, `--omit-header`.

`query` and `card run` also support: `--limit <n>` (default: 100), `--offset <n>` for pagination.

## Recommended Workflow

1. `mb db list` — discover available databases
2. `mb db tables <db-id>` — see tables in a database
3. `mb db fields <table-id>` — understand table schema
4. `mb query "SELECT ..." --db <id>` — run your query
5. If query returned many rows, use `--offset` to paginate

Or find existing reports:
1. `mb search "<keyword>"` — find saved cards/dashboards
2. `mb card view <id>` — check parameters needed
3. `mb card run <id> --params '{"key":"value"}'` — execute

## Output

- Default output is JSON (array of objects), ideal for AI parsing
- Pagination info goes to stderr, e.g.: `// Showing rows 1-100 of 1523`
- Errors go to stderr with exit code 1
```

- [ ] **Step 5: Commit**

```bash
git add skill.md
git commit -m "feat: add skill.md for AI agent distribution"
```

- [ ] **Step 6: Final commit — tag v0.1.0**

```bash
git tag v0.1.0
```

---

