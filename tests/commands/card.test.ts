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
