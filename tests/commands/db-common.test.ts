import { describe, expect, it } from "vitest";

describe("db common", () => {
  it("parses positive integer ids", async () => {
    const { parseRequiredId } = await import("../../src/commands/db/common.js");
    expect(parseRequiredId("12", "Database ID")).toBe(12);
  });

  it("rejects invalid ids without truncation", async () => {
    const { parseRequiredId } = await import("../../src/commands/db/common.js");
    expect(() => parseRequiredId("12foo", "Database ID")).toThrow(
      "Database ID must be a positive integer."
    );
    expect(() => parseRequiredId("1.5", "Database ID")).toThrow(
      "Database ID must be a positive integer."
    );
    expect(() => parseRequiredId("0", "Database ID")).toThrow(
      "Database ID must be a positive integer."
    );
  });
});
