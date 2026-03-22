# Metabase CLI (`mb`) Plan Index

> This file replaces the monolithic implementation plan and serves as the routing index for the split subplans.

**Goal:** Break the original end-to-end delivery plan into smaller, independently executable plan files without losing the original task mapping.

**Spec:** `docs/superpowers/specs/2026-03-22-metabase-cli-design.md`

---

## Decomposition Strategy

The original plan mixed shared runtime work, command-surface work, and final packaging in one document. It is now split by dependency boundary so later execution can parallelize safely after the baseline runtime is in place.

## Execution Order

- [x] `2026-03-22-metabase-cli-01-foundation-core.md` — Tasks 1-5, scaffolding and shared runtime baseline
- [ ] `2026-03-22-metabase-cli-02-auth-commands.md` — Task 6, `auth login/logout/status`
- [ ] `2026-03-22-metabase-cli-03-database-metadata.md` — Task 7, `db` metadata commands
- [ ] `2026-03-22-metabase-cli-04-query-and-card.md` — Tasks 8-9, SQL query and Card execution
- [ ] `2026-03-22-metabase-cli-05-search-collection-release.md` — Tasks 10-11, search/collection plus final release checks

Plans 02-04 can proceed in parallel once Plan 01 is complete. Plan 05 Task 10 only needs Plan 01, but Plan 05 Task 11 depends on every feature plan being finished.

## Task Mapping

| Original Task(s) | New Plan File | Scope |
|---|---|---|
| 1-5 | `docs/superpowers/plans/2026-03-22-metabase-cli-01-foundation-core.md` | Scaffolding, config, auth resolution, formatter, API client |
| 6 | `docs/superpowers/plans/2026-03-22-metabase-cli-02-auth-commands.md` | `auth login/logout/status` |
| 7 | `docs/superpowers/plans/2026-03-22-metabase-cli-03-database-metadata.md` | `db list/schemas/tables/fields/metadata` |
| 8-9 | `docs/superpowers/plans/2026-03-22-metabase-cli-04-query-and-card.md` | Native SQL plus Card list/view/run |
| 10-11 | `docs/superpowers/plans/2026-03-22-metabase-cli-05-search-collection-release.md` | Search, collections, final verification, `skill.md` |

## Notes

- The detailed checkbox steps from the original plan were preserved in the new subplan files.
- This index intentionally stays short so there is only one place to reason about sequencing and ownership.
