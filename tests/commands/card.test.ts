import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync } from "node:fs";
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

  describe("card create", () => {
    it("creates a card from inline flags with required defaults", async () => {
      mockFetch([{
        status: 200,
        body: { id: 99, name: "My Query", display: "table" },
      }]);
      const { handleCardCreate } = await import("../../src/commands/card/create.js");
      const result = await handleCardCreate({
        name: "My Query",
        database: "1",
        sql: "SELECT 1",
      });

      expect(result).toEqual({ id: 99, name: "My Query", display: "table" });

      const calls = getFetchCalls();
      expect(calls).toHaveLength(1);
      expect(calls[0].init?.method).toBe("POST");
      expect(calls[0].url).toMatch(/\/api\/card$/);
      expect(JSON.parse(calls[0].init?.body as string)).toEqual({
        name: "My Query",
        display: "table",
        type: "question",
        visualization_settings: {},
        dataset_query: {
          type: "native",
          database: 1,
          native: {
            query: "SELECT 1",
          },
        },
      });
    });

    it("creates a card from a --from JSON file", async () => {
      mockFetch([{
        status: 200,
        body: { id: 101, name: "Imported Card" },
      }]);
      const payload = {
        name: "Imported Card",
        display: "table",
        visualization_settings: {},
        dataset_query: {
          type: "native",
          database: 1,
          native: {
            query: "SELECT 1",
          },
        },
      };
      const filePath = join(testHome, "card-create.json");
      writeFileSync(filePath, JSON.stringify(payload), "utf8");

      const { handleCardCreate } = await import("../../src/commands/card/create.js");
      await handleCardCreate({ from: filePath });

      const calls = getFetchCalls();
      expect(calls).toHaveLength(1);
      expect(JSON.parse(calls[0].init?.body as string)).toEqual(payload);
    });

    it("rejects --from combined with inline flags before any API call", async () => {
      const payload = {
        name: "Imported Card",
        display: "table",
        visualization_settings: {},
        dataset_query: {
          type: "native",
          database: 1,
          native: {
            query: "SELECT 1",
          },
        },
      };
      const filePath = join(testHome, "card-create.json");
      writeFileSync(filePath, JSON.stringify(payload), "utf8");

      const { handleCardCreate } = await import("../../src/commands/card/create.js");
      await expect(
        handleCardCreate({ from: filePath, name: "Override" })
      ).rejects.toThrow(/--from/);
      expect(getFetchCalls()).toHaveLength(0);
    });

    it("rejects missing inline required flags before any API call", async () => {
      const { handleCardCreate } = await import("../../src/commands/card/create.js");
      await expect(
        handleCardCreate({ name: "Missing SQL", database: "1" })
      ).rejects.toThrow("Inline mode requires --name, --database, and --sql.");
      expect(getFetchCalls()).toHaveLength(0);
    });

    it("rejects non-object file payloads before any API call", async () => {
      const filePath = join(testHome, "card-create-invalid.json");
      writeFileSync(filePath, JSON.stringify([1, 2, 3]), "utf8");

      const { handleCardCreate } = await import("../../src/commands/card/create.js");
      await expect(
        handleCardCreate({ from: filePath })
      ).rejects.toThrow(/must be an object/i);
      expect(getFetchCalls()).toHaveLength(0);
    });
  });

  describe("card update", () => {
    it("updates a card via fetch-then-merge and preserves required fields", async () => {
      mockFetch([
        {
          status: 200,
          body: {
            id: 42,
            name: "Old Name",
            description: "Original description",
            display: "table",
            visualization_settings: { column_settings: {} },
            dataset_query: {
              type: "native",
              database: 1,
              native: { query: "SELECT 1" },
            },
            collection_id: 5,
          },
        },
        {
          status: 200,
          body: {
            id: 42,
            name: "New Name",
          },
        },
      ]);

      const { handleCardUpdate } = await import("../../src/commands/card/update.js");
      await handleCardUpdate(42, { name: "New Name" });

      const calls = getFetchCalls();
      expect(calls).toHaveLength(2);
      expect(calls[0].init?.method).toBe("GET");
      expect(calls[1].init?.method).toBe("PUT");
      const putBody = JSON.parse(calls[1].init?.body as string);
      expect(putBody.name).toBe("New Name");
      expect(putBody.dataset_query).toEqual({
        type: "native",
        database: 1,
        native: { query: "SELECT 1" },
      });
      expect(putBody.display).toBe("table");
      expect(putBody.visualization_settings).toEqual({ column_settings: {} });
      expect(putBody.collection_id).toBe(5);
    });

    it("updates native SQL cards with inline --sql", async () => {
      mockFetch([
        {
          status: 200,
          body: {
            id: 42,
            name: "Old Name",
            display: "table",
            visualization_settings: {},
            dataset_query: {
              type: "native",
              database: 1,
              native: { query: "SELECT 1" },
            },
          },
        },
        {
          status: 200,
          body: {
            id: 42,
            name: "Old Name",
          },
        },
      ]);

      const { handleCardUpdate } = await import("../../src/commands/card/update.js");
      await handleCardUpdate(42, { sql: "SELECT 2" });

      const calls = getFetchCalls();
      expect(calls).toHaveLength(2);
      const putBody = JSON.parse(calls[1].init?.body as string);
      expect(putBody.dataset_query).toEqual({
        type: "native",
        database: 1,
        native: { query: "SELECT 2" },
      });
      expect(putBody.display).toBe("table");
      expect(putBody.visualization_settings).toEqual({});
    });

    it("accepts NanoID collection identifiers for updates", async () => {
      const nanoId = "V1StGXR8_Z5jdHi6B-myT";
      mockFetch([
        {
          status: 200,
          body: {
            id: 42,
            name: "Old Name",
            display: "table",
            visualization_settings: {},
            dataset_query: {
              type: "native",
              database: 1,
              native: { query: "SELECT 1" },
            },
            collection_id: 5,
          },
        },
        {
          status: 200,
          body: {
            id: 42,
            collection_id: nanoId,
          },
        },
      ]);

      const { handleCardUpdate } = await import("../../src/commands/card/update.js");
      await handleCardUpdate(42, { collection: nanoId });

      const calls = getFetchCalls();
      expect(calls).toHaveLength(2);
      const putBody = JSON.parse(calls[1].init?.body as string);
      expect(putBody.collection_id).toBe(nanoId);
      expect(putBody.dataset_query).toEqual({
        type: "native",
        database: 1,
        native: { query: "SELECT 1" },
      });
    });

    it("rejects inline --sql for non-native cards before PUT", async () => {
      mockFetch([
        {
          status: 200,
          body: {
            id: 42,
            name: "MBQL Card",
            display: "table",
            visualization_settings: {},
            dataset_query: {
              type: "query",
              query: { "source-table": 1 },
            },
          },
        },
      ]);

      const { handleCardUpdate } = await import("../../src/commands/card/update.js");
      await expect(
        handleCardUpdate(42, { sql: "SELECT 2" })
      ).rejects.toThrow(/native-query/i);
      expect(getFetchCalls()).toHaveLength(1);
      expect(getFetchCalls()[0].init?.method).toBe("GET");
    });

    it("rejects --from combined with inline update flags before PUT", async () => {
      const filePath = join(testHome, "card-update-patch.json");
      writeFileSync(filePath, JSON.stringify({ name: "Patched Name" }), "utf8");

      const { handleCardUpdate } = await import("../../src/commands/card/update.js");
      await expect(
        handleCardUpdate(42, { from: filePath, name: "Override" })
      ).rejects.toThrow(/--from/);
      expect(getFetchCalls()).toHaveLength(0);
    });

    it("merges a JSON patch file onto the fetched card", async () => {
      const filePath = join(testHome, "card-update-patch.json");
      writeFileSync(
        filePath,
        JSON.stringify({
          description: "Updated description",
          archived: true,
        }),
        "utf8"
      );

      mockFetch([
        {
          status: 200,
          body: {
            id: 42,
            name: "Old Name",
            description: "Original description",
            display: "table",
            visualization_settings: {},
            dataset_query: {
              type: "native",
              database: 1,
              native: { query: "SELECT 1" },
            },
          },
        },
        {
          status: 200,
          body: {
            id: 42,
            name: "Old Name",
            description: "Updated description",
            archived: true,
          },
        },
      ]);

      const { handleCardUpdate } = await import("../../src/commands/card/update.js");
      await handleCardUpdate(42, { from: filePath });

      const calls = getFetchCalls();
      expect(calls).toHaveLength(2);
      const putBody = JSON.parse(calls[1].init?.body as string);
      expect(putBody.description).toBe("Updated description");
      expect(putBody.archived).toBe(true);
      expect(putBody.dataset_query).toEqual({
        type: "native",
        database: 1,
        native: { query: "SELECT 1" },
      });
      expect(putBody.display).toBe("table");
      expect(putBody.visualization_settings).toEqual({});
    });
  });

  describe("card delete/archive", () => {
    it("archives on delete by default", async () => {
      mockFetch([
        {
          status: 200,
          body: {
            id: 42,
            name: "Old Name",
            display: "table",
            visualization_settings: {},
            dataset_query: {
              type: "native",
              database: 1,
              native: { query: "SELECT 1" },
            },
            archived: false,
          },
        },
        {
          status: 200,
          body: {
            id: 42,
            archived: true,
          },
        },
      ]);

      const { handleCardDelete } = await import("../../src/commands/card/delete.js");
      const result = await handleCardDelete(42, {});
      expect(result).toEqual({ mode: "archived", id: 42 });

      const calls = getFetchCalls();
      expect(calls).toHaveLength(2);
      const putBody = JSON.parse(calls[1].init?.body as string);
      expect(putBody.archived).toBe(true);
    });

    it("hard deletes cards without throwing on 204", async () => {
      mockFetch([
        {
          status: 204,
          body: null,
        },
      ]);

      const { handleCardDelete } = await import("../../src/commands/card/delete.js");
      const result = await handleCardDelete(42, { hardDelete: true });
      expect(result).toEqual({ mode: "deleted", id: 42 });

      const calls = getFetchCalls();
      expect(calls).toHaveLength(1);
      expect(calls[0].init?.method).toBe("DELETE");
    });

    it("archives via the archive wrapper", async () => {
      mockFetch([
        {
          status: 200,
          body: {
            id: 42,
            name: "Old Name",
            display: "table",
            visualization_settings: {},
            dataset_query: {
              type: "native",
              database: 1,
              native: { query: "SELECT 1" },
            },
            archived: false,
          },
        },
        {
          status: 200,
          body: {
            id: 42,
            archived: true,
          },
        },
      ]);

      const { handleCardArchive } = await import("../../src/commands/card/archive.js");
      const result = await handleCardArchive(42, {});
      expect(result).toEqual({ mode: "archived", id: 42 });

      const calls = getFetchCalls();
      expect(calls).toHaveLength(2);
      const putBody = JSON.parse(calls[1].init?.body as string);
      expect(putBody.archived).toBe(true);
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

    it("resolves template-tags for native queries (dimension type)", async () => {
      mockFetch([
        {
          status: 200,
          body: {
            id: 3897,
            parameters: [],
            dataset_query: {
              type: "native",
              native: {
                query: "SELECT * FROM orders WHERE {{biz_type}}",
                "template-tags": {
                  biz_type: {
                    id: "tag-uuid-1",
                    name: "biz_type",
                    "display-name": "Biz Type",
                    type: "dimension",
                    "widget-type": "category",
                    dimension: ["field", 123, null],
                  },
                },
              },
            },
          },
        },
        {
          status: 200,
          body: {
            data: {
              rows: [[200]],
              cols: [{ name: "count", display_name: "Count", base_type: "type/Integer" }],
            },
          },
        },
      ]);
      const { handleCardRun } = await import("../../src/commands/card/run.js");
      const result = await handleCardRun(3897, {
        templateTags: '{"biz_type": "68"}',
      });
      expect(result.data).toEqual([{ count: 200 }]);

      const calls = getFetchCalls();
      expect(calls).toHaveLength(2);
      const postBody = JSON.parse(calls[1].init?.body as string);
      expect(postBody.parameters).toEqual([
        {
          id: "tag-uuid-1",
          type: "category",
          target: ["dimension", ["template-tag", "biz_type"]],
          value: ["68"],
        },
      ]);
    });

    it("resolves template-tags for variable type", async () => {
      mockFetch([
        {
          status: 200,
          body: {
            id: 100,
            parameters: [],
            dataset_query: {
              type: "native",
              native: {
                query: "SELECT * FROM orders WHERE name = {{name}}",
                "template-tags": {
                  name: {
                    id: "tag-uuid-2",
                    name: "name",
                    "display-name": "Name",
                    type: "text",
                  },
                },
              },
            },
          },
        },
        {
          status: 200,
          body: {
            data: {
              rows: [["Alice"]],
              cols: [{ name: "name", display_name: "Name", base_type: "type/Text" }],
            },
          },
        },
      ]);
      const { handleCardRun } = await import("../../src/commands/card/run.js");
      const result = await handleCardRun(100, {
        templateTags: '{"name": "Alice"}',
      });
      expect(result.data).toEqual([{ name: "Alice" }]);

      const calls = getFetchCalls();
      const postBody = JSON.parse(calls[1].init?.body as string);
      expect(postBody.parameters).toEqual([
        {
          id: "tag-uuid-2",
          type: "text",
          target: ["variable", ["template-tag", "name"]],
          value: "Alice",
        },
      ]);
    });

    it("throws error for unknown template tag key", async () => {
      mockFetch([
        {
          status: 200,
          body: {
            id: 42,
            parameters: [],
            dataset_query: {
              type: "native",
              native: {
                query: "SELECT 1",
                "template-tags": {
                  biz_type: { id: "t1", name: "biz_type", type: "text" },
                },
              },
            },
          },
        },
      ]);
      const { handleCardRun } = await import("../../src/commands/card/run.js");
      await expect(
        handleCardRun(42, { templateTags: '{"unknown_tag": "value"}' })
      ).rejects.toThrow(/unknown_tag/);
    });
  });
});
