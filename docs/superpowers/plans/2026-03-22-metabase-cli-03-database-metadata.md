# Metabase CLI (`mb`) Database Metadata Commands Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Tech Stack:** TypeScript 5, Node.js 18+, commander 12, vitest, pnpm

**Spec:** `docs/superpowers/specs/2026-03-22-metabase-cli-design.md`

**Goal:** Implement the metadata exploration commands for databases, schemas, tables, fields, and raw metadata dumps.

**Architecture:** Keep each `db` subcommand in its own module and route every request through the shared API client plus shared output formatting. The result should provide a clean read-only metadata surface for AI agents before any query execution features are added.

**Dependencies:** Requires Plan 01 (`2026-03-22-metabase-cli-01-foundation-core.md`).

**Covers Original Tasks:** 7

---

## Included Tasks
### Task 7: Database Metadata Commands

**Files:**
- Create: `src/commands/db/list.ts`
- Create: `src/commands/db/schemas.ts`
- Create: `src/commands/db/tables.ts`
- Create: `src/commands/db/fields.ts`
- Create: `src/commands/db/metadata.ts`
- Modify: `src/index.ts` — register db subcommands
- Create: `tests/commands/db.test.ts`

- [ ] **Step 1: Write tests for db commands**

Create `tests/commands/db.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { mockFetch, resetMock } from "../helpers/mock-server.js";

let testHome: string;

describe("db commands", () => {
  beforeEach(() => {
    vi.resetModules();
    testHome = join(tmpdir(), `mb-db-test-${Date.now()}`);
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

  describe("db list", () => {
    it("returns list of databases", async () => {
      mockFetch([{
        status: 200,
        body: { data: [
          { id: 1, name: "Production", engine: "postgres" },
          { id: 2, name: "Analytics", engine: "bigquery" },
        ]},
      }]);
      const { handleDbList } = await import("../../src/commands/db/list.js");
      const result = await handleDbList({});
      expect(result).toEqual([
        { id: 1, name: "Production", engine: "postgres" },
        { id: 2, name: "Analytics", engine: "bigquery" },
      ]);
    });
  });

  describe("db schemas", () => {
    it("returns schemas for a database", async () => {
      mockFetch([{
        status: 200,
        body: ["public", "analytics", "raw"],
      }]);
      const { handleDbSchemas } = await import("../../src/commands/db/schemas.js");
      const result = await handleDbSchemas(1, {});
      expect(result).toEqual(["public", "analytics", "raw"]);
    });
  });

  describe("db tables", () => {
    it("returns tables from database metadata", async () => {
      mockFetch([{
        status: 200,
        body: { tables: [
          { id: 10, name: "users", schema: "public" },
          { id: 11, name: "orders", schema: "public" },
        ]},
      }]);
      const { handleDbTables } = await import("../../src/commands/db/tables.js");
      const result = await handleDbTables(1, {});
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe("users");
    });

    it("returns tables for a specific schema", async () => {
      mockFetch([{
        status: 200,
        body: [
          { id: 10, name: "users", schema: "public" },
          { id: 11, name: "orders", schema: "public" },
        ],
      }]);
      const { handleDbTables } = await import("../../src/commands/db/tables.js");
      const result = await handleDbTables(1, { schema: "public" });
      expect(result).toHaveLength(2);
    });
  });

  describe("db fields", () => {
    it("returns fields for a table", async () => {
      mockFetch([{
        status: 200,
        body: { fields: [
          { id: 1, name: "id", database_type: "int4", description: "Primary key" },
          { id: 2, name: "name", database_type: "varchar", description: "User name" },
        ]},
      }]);
      const { handleDbFields } = await import("../../src/commands/db/fields.js");
      const result = await handleDbFields(10, {});
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: 1, name: "id", database_type: "int4", description: "Primary key",
      });
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test -- tests/commands/db.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement db list**

Create `src/commands/db/list.ts`:

```typescript
import { Command } from "commander";
import { createApiClient } from "../../lib/api-client.js";
import { output } from "../../lib/formatter.js";
import type { GlobalOptions } from "../../types/index.js";

export async function handleDbList(opts: GlobalOptions): Promise<any[]> {
  const client = createApiClient(opts);
  const res = await client.get("/api/database");
  // Metabase wraps in { data: [...] }
  return res.data || res;
}

export function registerDbListCommand(parent: Command): void {
  parent
    .command("list")
    .description("List all databases")
    .action(async function (this: Command) {
      const opts = this.optsWithGlobals();
      try {
        const data = await handleDbList(opts);
        const simplified = data.map((db: any) => ({
          id: db.id,
          name: db.name,
          engine: db.engine,
        }));
        output(simplified, opts);
      } catch (e: any) {
        process.stderr.write(`Error: ${e.message}\n`);
        process.exit(1);
      }
    });
}
```

- [ ] **Step 4: Implement db schemas**

Create `src/commands/db/schemas.ts`:

```typescript
import { Command } from "commander";
import { createApiClient } from "../../lib/api-client.js";
import { output } from "../../lib/formatter.js";
import type { GlobalOptions } from "../../types/index.js";

export async function handleDbSchemas(dbId: number, opts: GlobalOptions): Promise<string[]> {
  const client = createApiClient(opts);
  return client.get(`/api/database/${dbId}/schemas`);
}

export function registerDbSchemasCommand(parent: Command): void {
  parent
    .command("schemas <db-id>")
    .description("List schemas in a database")
    .action(async function (this: Command, dbId: string) {
      const opts = this.optsWithGlobals();
      try {
        const schemas = await handleDbSchemas(parseInt(dbId), opts);
        // Output as array of objects for consistent formatting
        const data = schemas.map((s: string) => ({ schema: s }));
        output(data, opts);
      } catch (e: any) {
        process.stderr.write(`Error: ${e.message}\n`);
        process.exit(1);
      }
    });
}
```

- [ ] **Step 5: Implement db tables**

Create `src/commands/db/tables.ts`:

```typescript
import { Command } from "commander";
import { createApiClient } from "../../lib/api-client.js";
import { output } from "../../lib/formatter.js";
import type { GlobalOptions } from "../../types/index.js";

export async function handleDbTables(
  dbId: number,
  opts: GlobalOptions & { schema?: string }
): Promise<any[]> {
  const client = createApiClient(opts);

  if (opts.schema) {
    // Use dedicated schema endpoint
    const tables = await client.get(
      `/api/database/${dbId}/schema/${encodeURIComponent(opts.schema)}`
    );
    return tables;
  }

  // Use full metadata endpoint, extract tables
  const metadata = await client.get(`/api/database/${dbId}/metadata`);
  return metadata.tables || [];
}

export function registerDbTablesCommand(parent: Command): void {
  parent
    .command("tables <db-id>")
    .description("List tables in a database")
    .option("--schema <name>", "Filter by schema name")
    .action(async function (this: Command, dbId: string) {
      const opts = this.optsWithGlobals();
      try {
        const tables = await handleDbTables(parseInt(dbId), opts);
        const simplified = tables.map((t: any) => ({
          id: t.id,
          name: t.name,
          schema: t.schema,
        }));
        output(simplified, opts);
      } catch (e: any) {
        process.stderr.write(`Error: ${e.message}\n`);
        process.exit(1);
      }
    });
}
```

- [ ] **Step 6: Implement db fields**

Create `src/commands/db/fields.ts`:

```typescript
import { Command } from "commander";
import { createApiClient } from "../../lib/api-client.js";
import { output } from "../../lib/formatter.js";
import type { GlobalOptions } from "../../types/index.js";

export async function handleDbFields(tableId: number, opts: GlobalOptions): Promise<any[]> {
  const client = createApiClient(opts);
  const metadata = await client.get(`/api/table/${tableId}/query_metadata`);
  return (metadata.fields || []).map((f: any) => ({
    id: f.id,
    name: f.name,
    database_type: f.database_type,
    description: f.description || null,
  }));
}

export function registerDbFieldsCommand(parent: Command): void {
  parent
    .command("fields <table-id>")
    .description("List fields of a table")
    .action(async function (this: Command, tableId: string) {
      const opts = this.optsWithGlobals();
      try {
        const fields = await handleDbFields(parseInt(tableId), opts);
        output(fields, opts);
      } catch (e: any) {
        process.stderr.write(`Error: ${e.message}\n`);
        process.exit(1);
      }
    });
}
```

- [ ] **Step 7: Implement db metadata**

Create `src/commands/db/metadata.ts`:

```typescript
import { Command } from "commander";
import { createApiClient } from "../../lib/api-client.js";
import { formatJson } from "../../lib/formatter.js";
import type { GlobalOptions } from "../../types/index.js";

export function registerDbMetadataCommand(parent: Command): void {
  parent
    .command("metadata <db-id>")
    .description("Full database metadata dump")
    .action(async function (this: Command, dbId: string) {
      const opts = this.optsWithGlobals();
      try {
        const client = createApiClient(opts);
        const metadata = await client.get(`/api/database/${parseInt(dbId)}/metadata`);
        process.stdout.write(formatJson(metadata) + "\n");
      } catch (e: any) {
        process.stderr.write(`Error: ${e.message}\n`);
        process.exit(1);
      }
    });
}
```

- [ ] **Step 8: Register db commands in index.ts**

Add to `src/index.ts` after auth commands:

```typescript
import { registerDbListCommand } from "./commands/db/list.js";
import { registerDbSchemasCommand } from "./commands/db/schemas.js";
import { registerDbTablesCommand } from "./commands/db/tables.js";
import { registerDbFieldsCommand } from "./commands/db/fields.js";
import { registerDbMetadataCommand } from "./commands/db/metadata.js";

// DB commands
const dbCmd = program.command("db").description("Database metadata operations");
registerDbListCommand(dbCmd);
registerDbSchemasCommand(dbCmd);
registerDbTablesCommand(dbCmd);
registerDbFieldsCommand(dbCmd);
registerDbMetadataCommand(dbCmd);
```

Also add global options to the program (before `program.parse()`):

```typescript
program
  .option("--host <url>", "Metabase server URL")
  .option("--token <value>", "Authentication token")
  .option("--format <type>", "Output format: json, csv, table", "json")
  .option("--json <fields>", "Select specific JSON fields")
  .option("--jq <expr>", "Filter with JMESPath expression")
  .option("--omit-header", "Omit header in table/CSV output");
```

- [ ] **Step 9: Run tests to verify they pass**

Run: `pnpm test -- tests/commands/db.test.ts`
Expected: All tests PASS.

- [ ] **Step 10: Commit**

```bash
git add src/commands/db/ src/index.ts tests/commands/db.test.ts
git commit -m "feat: add db commands (list, schemas, tables, fields, metadata)"
```

---

