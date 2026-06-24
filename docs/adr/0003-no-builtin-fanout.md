---
status: proposed
---

# 0003 — No built-in fan-out across Profiles in v1

## Decision

`mb` commands operate on exactly one Profile per invocation. Querying
multiple Profiles is left to the shell — typically a loop plus `jq -s
'add'` to merge JSON arrays. The `--profile` flag accepts a single alias;
comma-separated lists are reserved for a possible future extension but
not implemented in v1.

## Why

The original motivating need ("query multiple sources without logging
out") is fully met by per-invocation Profile selection plus `_source`
attribution (ADRs 0001, 0002). Shell-level fan-out costs the user a
two-line loop; the merged output is unambiguous because every row already
carries its origin.

Built-in fan-out would introduce a cluster of new design decisions whose
defaults are non-obvious:

- Partial failure semantics — does one failed Profile fail the whole
  command? What exit code?
- Concurrency limits and per-Profile timeouts.
- Output ordering — preserve `--profile` order, or stream as results
  arrive?
- How `--db <id>` resolves when Profiles disagree on which database `id`
  means.

Each of these is a new bug surface and a new piece of documentation, paid
for by saving the user a one-line loop. The trade is bad at v1 scale.

This decision is deliberately recorded because the question *will* recur
— it is the obvious "next feature" once Profiles exist. Future
contributors should know it was considered and declined for specific
reasons, not overlooked.

## Considered options

- **`--profile a,b,c` runs in parallel, merges results.** Rejected for
  v1 — see partial-failure / concurrency / ordering concerns above.
- **A separate `mb fanout <cmd>` subcommand.** Rejected — second top-
  level surface for the same identity model doubles the documentation
  burden and shell loops cover the use case.
- **Library-mode (`mb` as a Node API consumed by user scripts).**
  Rejected as out of scope; the CLI is the contract.

## Consequences

- Agents fanning out across Profiles do it in their orchestration layer
  (one tool call per Profile), then merge. `_source` makes the merge
  trivial.
- If real demand emerges later, `--profile a,b,c` is the natural
  extension and the syntax space is reserved. The bar for accepting that
  PR is: a clear answer to every concern listed in "Why" above, with
  tests.
- Documentation must include a short shell recipe (`for p in ...; do mb
  ... --profile "$p"; done | jq -s 'add'`) so users do not assume the
  feature is missing by oversight.
