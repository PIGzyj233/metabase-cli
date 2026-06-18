import { describe, it, expect } from "vitest";
import { humanizeQueryError } from "../../src/lib/error-message.js";

describe("humanizeQueryError", () => {
  it("wraps parse-tokens schema errors with a hint and preserves original", () => {
    const raw =
      "\x1B[0;33mOutput of parse-tokens does not match schema: [(not (matches-some-precondition? nil))]\x1B[0m";
    const out = humanizeQueryError(raw);
    expect(out.startsWith("Hint:")).toBe(true);
    expect(out).toMatch(/template tags/i);
    // Original text preserved (ANSI stripped) after the Metabase: marker.
    expect(out).toContain("Output of parse-tokens does not match schema:");
    expect(out).toContain("matches-some-precondition");
    // No ANSI escapes leak into the output.
    expect(out).not.toContain("\x1B");
  });

  it("wraps date-string->range schema errors with a date hint", () => {
    const raw =
      "Input to date-string->range does not match schema: [(named (not (instance? java.lang.String [\"2026-06-01\"])) date-string) nil]";
    const out = humanizeQueryError(raw);
    expect(out.startsWith("Hint:")).toBe(true);
    expect(out).toMatch(/YYYY-MM-DD/);
    expect(out).toContain("Input to date-string->range does not match schema:");
  });

  it("passes real SQL errors through verbatim", () => {
    const raw =
      "ClickHouse exception, code: 60, host: 10.53.240.195, port: 8123; Code: 60, e.displayText() = DB::Exception: Table game.dwd_cloudgame_game_flow_inc doesn't exist (version 21.1.9.41 (official build))";
    expect(humanizeQueryError(raw)).toBe(raw);
  });

  it("passes CLI-friendly 'Unknown template tag' errors through verbatim", () => {
    const raw = 'Unknown template tag "nope". Available tags: dt, biz_type, ls_version, area_type';
    expect(humanizeQueryError(raw)).toBe(raw);
  });

  it("passes CLI-friendly 'Unknown parameter' errors through verbatim", () => {
    const raw = 'Unknown parameter "dt". Available parameters: (none)';
    expect(humanizeQueryError(raw)).toBe(raw);
  });

  it("passes empty string through verbatim", () => {
    expect(humanizeQueryError("")).toBe("");
  });

  it("does not false-positive on a DB identifier containing 'parse-tokens' as a substring", () => {
    // Lead-in is absent — a real SQL error echoing a table/column named parse-tokens.
    const raw =
      "ClickHouse exception, code: 60 ... Table schema.parse-tokens doesn't exist";
    expect(humanizeQueryError(raw)).toBe(raw);
  });

  it("passes fallback failure messages through verbatim", () => {
    expect(humanizeQueryError("Query execution failed")).toBe("Query execution failed");
    expect(humanizeQueryError("Card query execution failed")).toBe(
      "Card query execution failed",
    );
  });

  it("uses a generic hint for an unrecognized schema fn name", () => {
    const raw = "Input to some-fn-we-never-heard-of does not match schema: [...]";
    const out = humanizeQueryError(raw);
    expect(out.startsWith("Hint:")).toBe(true);
    expect(out).toMatch(/parameter/i);
    expect(out).toContain(raw);
  });
});
