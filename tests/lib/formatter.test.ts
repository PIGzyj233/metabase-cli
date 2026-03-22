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
