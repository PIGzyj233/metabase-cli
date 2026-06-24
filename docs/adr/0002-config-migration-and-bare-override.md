---
status: proposed
---

# 0002 — Config migration and the bare-override path

## Decision

On first read of an existing `~/.config/mb/config.yml`, the CLI silently
rewrites the legacy `hosts` shape into the Profile shape introduced by ADR
0001. For each legacy host entry, a Profile alias is derived from its Host
key (replace `.`/`:`/`/` with `-`, trim, truncate to 32 chars, suffix `-2`
etc. on collisions). `current_host` migrates to `current_profile`. A
one-line notice goes to stderr; no interactive prompt.

The bare `MB_HOST` + `MB_TOKEN` (and `--host` + `--token`) path is kept
permanently as a Profile-less escape hatch, with two hard constraints:

1. **Bare override is never persisted.** `auth login` ignores `MB_HOST`
   unless `--host` is also passed explicitly; environment-only auth is
   ephemeral, in-memory, never written to `config.yml`.
2. **Profile-management verbs (`auth list`, `use`, `rm`, `status` without
   `--profile`) ignore the bare-override environment entirely** and operate
   only on the on-disk Profile set. The two systems are orthogonal: env
   vars decide *runtime identity*, config file decides *the Profile
   inventory*.

## Why

Forcing existing users through a manual migration step on upgrade is hostile
and breaks non-TTY contexts (CI, agent shells). Auto-migration with a
deterministic alias rule is reversible (`auth rm` + `auth login --as
nicer-name`) and zero-friction.

The bare-override path is real-world load-bearing: one-shot scripts, CI jobs,
Dockerfiles, and ephemeral agent sessions inject credentials via environment
variables and have no use for a persisted Profile. Demanding `auth login --as
ci` in those contexts buys nothing. The two constraints above contain the
"two parallel systems" complexity to the identity-resolution layer alone — it
does not leak into Profile management, which stays single-source-of-truth on
disk.

## Considered options

- **Manual `mb auth migrate` command.** Rejected — honest but rude;
  non-interactive shells would have to be hand-held through it.
- **Keep `hosts` and `profiles` running in parallel forever.** Rejected —
  permanent two-path code in every auth-touching call site.
- **Deprecate `MB_HOST` + `MB_TOKEN`, remove in v2.** Rejected — the use
  cases are legitimate and unlikely to disappear. Better to scope the
  complexity than excise the feature.
- **Bare override writes through to config (treat env vars as defaults
  during login).** Rejected — magic auto-persistence is exactly the kind of
  surprise Profiles exist to eliminate.

## Consequences

- `config.yml` schema gains a `profiles` map and `current_profile`; the
  legacy `hosts` / `current_host` keys are read once for migration then no
  longer written. Old keys are left as empty stubs (`hosts: {}`,
  `current_host: null`) for one release as a rollback hint, then dropped.
- Alias generation is deterministic and idempotent — re-running migration
  on an already-migrated config is a no-op.
- The bare-override path emits `_source: "<host-key>"` per ADR 0001's type-
  stable rule. No code path ever produces `_source: null` or an absent
  field.
- Documentation must explicitly call out the orthogonality: "Profile
  management commands act on `~/.config/mb/config.yml`, not on environment
  variables." This is the single most likely source of user confusion.
