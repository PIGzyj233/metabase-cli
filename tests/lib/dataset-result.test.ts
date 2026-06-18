import { describe, expect, it } from "vitest";
import { unpackDatasetResult } from "../../src/lib/dataset-result.js";

describe("dataset-result", () => {
  it("converts rows and cols to objects", () => {
    const result = unpackDatasetResult(
      {
        data: {
          rows: [[1, "Alice"], [2, "Bob"]],
          cols: [{ name: "id" }, { name: "name" }],
        },
      },
      { failureMessage: "Query execution failed" },
    );

    expect(result.data).toEqual([
      { id: 1, name: "Alice" },
      { id: 2, name: "Bob" },
    ]);
  });

  it("uses default pagination", () => {
    const result = unpackDatasetResult(
      {
        data: {
          rows: [[1]],
          cols: [{ name: "id" }],
        },
      },
      { failureMessage: "Query execution failed" },
    );

    expect(result.pagination).toEqual({
      total: 1,
      offset: 0,
      limit: 100,
    });
  });

  it("uses custom limit and offset", () => {
    const result = unpackDatasetResult(
      {
        data: {
          rows: [[1], [2], [3], [4]],
          cols: [{ name: "id" }],
        },
      },
      {
        limit: 2,
        offset: 1,
        failureMessage: "Query execution failed",
      },
    );

    expect(result.data).toEqual([{ id: 2 }, { id: 3 }]);
    expect(result.pagination).toEqual({
      total: 4,
      offset: 1,
      limit: 2,
    });
  });

  it("returns empty data and pagination for missing data", () => {
    const result = unpackDatasetResult(
      {},
      {
        limit: 10,
        offset: 5,
        failureMessage: "Query execution failed",
      },
    );

    expect(result).toEqual({
      data: [],
      pagination: {
        total: 0,
        offset: 5,
        limit: 10,
      },
    });
  });

  it("throws when status is failed", () => {
    expect(() =>
      unpackDatasetResult(
        { status: "failed" },
        { failureMessage: "Query execution failed" },
      ),
    ).toThrow("Query execution failed");
  });

  it("prefers raw error over fallback messages", () => {
    expect(() =>
      unpackDatasetResult(
        {
          status: "failed",
          error: "Raw query error",
          json_query: { error: "JSON query error" },
        },
        { failureMessage: "Query execution failed" },
      ),
    ).toThrow("Raw query error");
  });

  it("uses json_query error before fallback", () => {
    expect(() =>
      unpackDatasetResult(
        {
          status: "failed",
          json_query: { error: "JSON query error" },
        },
        { failureMessage: "Query execution failed" },
      ),
    ).toThrow("JSON query error");
  });
});
