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
      expect(result[0].name).toBe("Our analytics");
    });

    it("filters by parent collection", async () => {
      mockFetch([{
        status: 200,
        body: [
          { id: 1, name: "Our analytics", location: "/", parent_id: null },
          { id: 3, name: "Sub Collection", location: "/1/", parent_id: 1 },
          { id: 4, name: "Another Sub", location: "/1/", parent_id: 1 },
        ],
      }]);
      const { handleCollectionList } = await import(
        "../../src/commands/collection/list.js"
      );
      const result = await handleCollectionList({ parent: 1 });
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
      expect(result[0].model).toBe("card");
    });

    it("returns empty array for empty collection", async () => {
      mockFetch([{
        status: 200,
        body: { data: [] },
      }]);
      const { handleCollectionView } = await import(
        "../../src/commands/collection/view.js"
      );
      const result = await handleCollectionView(99, {});
      expect(result).toHaveLength(0);
    });
  });
});
