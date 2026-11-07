import { describe, expect, it } from "vitest";
import { Readable } from "node:stream";
import { MAX_INPUT_BYTES, readInputText } from "../../src/lib/input-source.js";

describe("bounded UTF-8 input", () => {
  it("preserves literal text and decodes multibyte characters split across chunks", async () => {
    const text = "SELECT '中文', '$HOME', '`literal`'\nFROM orders;\n";
    const bytes = Buffer.from(text);
    const stream = Readable.from([bytes.subarray(0, 9), bytes.subarray(9)]);
    expect(await readInputText("-", "SQL input", stream)).toBe(text);
  });

  it("refuses interactive stdin instead of waiting for input", async () => {
    const stream = Object.assign(Readable.from([]), { isTTY: true });
    await expect(readInputText("-", "SQL input", stream)).rejects.toThrow(/stdin is interactive/);
  });

  it("rejects empty, malformed UTF-8, and oversized input", async () => {
    await expect(readInputText("-", "SQL input", Readable.from([" \n"]))).rejects.toThrow(/must not be empty/);
    await expect(readInputText("-", "SQL input", Readable.from([Buffer.from([0xff])]))).rejects.toThrow(/UTF-8/);
    await expect(readInputText("-", "SQL input", Readable.from([Buffer.alloc(MAX_INPUT_BYTES + 1)]))).rejects.toThrow(/16 MiB/);
  });
});
