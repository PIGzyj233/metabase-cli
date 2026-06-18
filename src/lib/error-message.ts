// Maps opaque Metabase/Clojure-schema error strings to agent-friendly hints.
// Strictly additive: unknown strings pass through verbatim. The original
// upstream text is always preserved after "Metabase:" so humans and agents
// retain the ground-truth diagnostic.

const ANSI_RE = /\x1B\[[0-9;]*m/g;

// Lead-in of Metabase's Clojure schema errors, e.g.
//   "Output of parse-tokens does not match schema: ..."
//   "Input to date-string->range does not match schema: ..."
const SCHEMA_LEADIN_RE = /^(?:Output of|Input to) (\S+) does not match schema:/;

const HINTS: Record<string, string> = {
  "parse-tokens":
    "Query has unfilled template tags or parameters of the wrong type. Provide --template-tags / --params with valid values.",
  "date-string->range":
    "A date parameter received a non-date value. Use YYYY-MM-DD (or a date range).",
};

const GENERIC_HINT =
  "Metabase rejected a parameter's schema. Check --params / --template-tags values and types.";

function stripAnsi(s: string): string {
  return s.replace(ANSI_RE, "");
}

/**
 * Wrap known-opaque Metabase schema-validation errors with an agent-friendly
 * hint. Returns the input unchanged for anything it doesn't recognize
 * (real SQL errors, CLI-friendly errors, fallback messages, empty strings).
 */
export function humanizeQueryError(raw: string): string {
  if (!raw) return raw;

  const cleaned = stripAnsi(raw);
  const match = cleaned.match(SCHEMA_LEADIN_RE);
  if (!match) return raw; // pass-through, ANSI and all

  const fnName = match[1];
  const hint = HINTS[fnName] ?? GENERIC_HINT;
  return `Hint: ${hint}\nMetabase: ${cleaned}`;
}
