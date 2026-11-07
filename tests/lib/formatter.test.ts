import { describe, it, expect, vi } from "vitest";
import {
  formatJson,
  formatCsv,
  formatTable,
  applyJsonFieldSelection,
  applyJmesPath,
  formatPaginationInfo,
  formatQueryResult,
  output,
  withSourceAttribution,
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

    it("preserves duplicate columns without stealing existing suffixed names", () => {
      const result = formatQueryResult(
        [[1, 2, 3, 4, 5], [6, 7, 8, 9, 10]],
        ["id", "id", "id_2", "id", "id_2"].map((name) => ({ name })),
      );
      expect(result).toEqual([
        { id: 1, id_3: 2, id_2: 3, id_4: 4, id_2_2: 5 },
        { id: 6, id_3: 7, id_2: 8, id_4: 9, id_2_2: 10 },
      ]);
      expect(formatCsv(result).trim().split("\n")).toEqual([
        "id,id_3,id_2,id_4,id_2_2", "1,2,3,4,5", "6,7,8,9,10",
      ]);
    });

    it("retains prototype-like column names as ordinary JSON properties", () => {
      const value = { nested: true };
      const [row] = formatQueryResult(
        [[value, "second", "constructor value", "toString value"]],
        ["__proto__", "__proto__", "constructor", "toString"].map((name) => ({ name })),
      );
      expect(Object.getPrototypeOf(row)).toBe(Object.prototype);
      expect(Object.hasOwn(row, "__proto__")).toBe(true);
      expect(JSON.parse(formatJson(row))).toEqual(JSON.parse(
        '{"__proto__":{"nested":true},"__proto___2":"second","constructor":"constructor value","toString":"toString value"}',
      ));
    });
  });

  describe("formatJson", () => {
    it("outputs JSON string", () => {
      const data = [{ id: 1, name: "Alice" }];
      const output = formatJson(data);
      expect(JSON.parse(output)).toEqual(data);
    });
  });

  describe("output source context", () => {
    it("injects _source into JSON records and emits a Source line", () => {
      const stdout = vi
        .spyOn(process.stdout, "write")
        .mockImplementation(() => true);
      const stderr = vi
        .spyOn(process.stderr, "write")
        .mockImplementation(() => true);

      output([{ id: 1 }], {
        format: "json",
        sourceId: "customer-a",
        sourceUrl: "https://mb.customer-a.test",
      });

      expect(JSON.parse(String(stdout.mock.calls[0][0]))).toEqual([
        { id: 1, _source: "customer-a" },
      ]);
      expect(String(stderr.mock.calls[0][0])).toContain(
        "// Source: customer-a (https://mb.customer-a.test)"
      );
    });
  });

  describe("withSourceAttribution", () => {
    it("adds a non-empty _source without overwriting existing values", () => {
      expect(
        withSourceAttribution(
          [{ id: 1 }, { id: 2, _source: "preserved" }],
          "customer-a"
        )
      ).toEqual([
        { id: 1, _source: "customer-a" },
        { id: 2, _source: "preserved" },
      ]);
      expect(withSourceAttribution([], "customer-a")).toEqual([]);
      expect(() => withSourceAttribution([{ id: 1 }], "")).toThrow(
        /non-empty/
      );
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
    it("warns that changing the slice submits the query again", () => {
      const msg = formatPaginationInfo({ total: 200, offset: 0, limit: 100 });
      expect(msg).toContain("local output slice");
      expect(msg).toContain("submitting the query again");
      expect(msg).toContain("results may change");
    });

    it("reports an exhausted slice without an inverted row range", () => {
      const msg = formatPaginationInfo({ total: 3, offset: 10, limit: 100 });
      expect(msg).toContain("No rows at offset 10");
      expect(msg).not.toContain("11-3");
      expect(msg).not.toContain("next slice");
    });

    it("warns about upstream truncation even when all returned rows fit", () => {
      const msg = formatPaginationInfo({ total: 3, offset: 0, limit: 100, truncated: true });
      expect(msg).toContain("Metabase truncated");
      expect(msg).toContain("not the full query total");
      expect(msg).toContain("--offset cannot recover");
    });

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
