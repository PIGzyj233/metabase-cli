import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  getFetchCalls,
  mockFetch,
  resetMock,
} from "../helpers/mock-server.js";

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
      mockFetch([
        {
          status: 200,
          body: {
            data: [
              { id: 1, name: "Production", engine: "postgres" },
              { id: 2, name: "Analytics", engine: "bigquery" },
            ],
          },
        },
      ]);

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
      mockFetch([
        {
          status: 200,
          body: ["public", "analytics", "raw"],
        },
      ]);

      const { handleDbSchemas } = await import(
        "../../src/commands/db/schemas.js"
      );
      const result = await handleDbSchemas(1, {});

      expect(result).toEqual(["public", "analytics", "raw"]);
      expect(getFetchCalls()[0]?.url).toBe(
        "https://metabase.test.com/api/database/1/schemas"
      );
    });
  });

  describe("db tables", () => {
    it("returns tables from database metadata", async () => {
      mockFetch([
        {
          status: 200,
          body: {
            tables: [
              { id: 10, name: "users", schema: "public" },
              { id: 11, name: "orders", schema: "public" },
            ],
          },
        },
      ]);

      const { handleDbTables } = await import("../../src/commands/db/tables.js");
      const result = await handleDbTables(1, {});

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        id: 10,
        name: "users",
        schema: "public",
      });
    });

    it("returns tables for a specific schema and URL-encodes the schema name", async () => {
      mockFetch([
        {
          status: 200,
          body: [
            { id: 10, name: "users", schema: "analytics raw" },
            { id: 11, name: "orders", schema: "analytics raw" },
          ],
        },
      ]);

      const { handleDbTables } = await import("../../src/commands/db/tables.js");
      const result = await handleDbTables(1, { schema: "analytics raw" });

      expect(result).toHaveLength(2);
      expect(getFetchCalls()[0]?.url).toBe(
        "https://metabase.test.com/api/database/1/schema/analytics%20raw"
      );
    });
  });

  describe("db fields", () => {
    it("returns fields for a table", async () => {
      mockFetch([
        {
          status: 200,
          body: {
            fields: [
              {
                id: 1,
                name: "id",
                database_type: "int4",
                description: "Primary key",
              },
              {
                id: 2,
                name: "name",
                database_type: "varchar",
              },
            ],
          },
        },
      ]);

      const { handleDbFields } = await import("../../src/commands/db/fields.js");
      const result = await handleDbFields(10, {});

      expect(result).toEqual([
        {
          id: 1,
          name: "id",
          database_type: "int4",
          description: "Primary key",
        },
        {
          id: 2,
          name: "name",
          database_type: "varchar",
          description: null,
        },
      ]);
    });
  });

  describe("db metadata", () => {
    it("returns the raw database metadata payload", async () => {
      const metadata = {
        id: 1,
        name: "Production",
        tables: [{ id: 10, name: "users", schema: "public" }],
      };
      mockFetch([{ status: 200, body: metadata }]);

      const { handleDbMetadata } = await import(
        "../../src/commands/db/metadata.js"
      );
      const result = await handleDbMetadata(1, {});

      expect(result).toEqual(metadata);
    });
  });
});