# PRD — Multi-source authentication via named Profiles

## Problem Statement

I work against several Metabase instances at once — different customers,
different staging/prod splits, sometimes two accounts (read-only vs admin)
on the same instance. Today `mb` only remembers one identity at a time:
running `auth login` against a second instance silently overwrites the
first, and even when two hosts coexist in `config.yml` I have to remember
their full URLs to switch. Inside an AI-agent session I cannot ask the
agent to "query customer A's orders, then customer B's" without it
fighting the CLI's stateful login. There is also no way, when output is
piped to a model, to tell which source any given row came from.

## Solution

Introduce **Profile**: a user-named binding of one Metabase instance URL
to one set of credentials. Users authenticate once per Profile, give it a
short alias, and from then on any command can target any Profile by name
— either by setting it as the Active Profile (`auth use`) or by passing
`--profile <alias>` / `MB_PROFILE` on a single invocation. Every record
in stdout JSON output carries a `_source` field naming the Profile (or
the underlying host key, on the Profile-less bare-override path) so
multi-source pipelines are self-attributing without any flag.

The existing `--host` + `--token` / `MB_HOST` + `MB_TOKEN` path stays as
a Profile-less escape hatch for one-shot scripts and CI, with strict
boundaries: it is never persisted, it does not interact with Profile
management commands, and it is mutually exclusive with `--profile` on
the same invocation.

## User Stories

1. As a multi-tenant analyst, I want to log in to two different Metabase
   instances and give each a short alias, so that I can refer to them by
   name instead of by URL.
2. As a multi-tenant analyst, I want to query "customer A" without
   logging out of "customer B", so that I can interleave commands across
   sources in a single shell session.
3. As an admin who has both a read-only and an admin account on the same
   Metabase instance, I want to keep them as separate Profiles, so that
   I do not accidentally run destructive commands as the wrong identity.
4. As an AI agent, I want to set `MB_PROFILE=customer_a` at the start of
   a task, so that subsequent tool calls go to one source without me
   having to repeat the flag.
5. As an AI agent, I want to pass `--profile customer_b` on a single
   command, so that I can dip into a different source mid-task without
   touching the environment.
6. As an AI agent merging output from three Profiles, I want each row to
   carry a `_source` field, so that after `jq -s 'add'` I can still tell
   which row came from which Profile.
7. As an operator running a CI job, I want to keep using `MB_HOST` +
   `MB_TOKEN` without first creating a Profile, so that ephemeral
   pipelines do not have to persist anything to disk.
8. As an operator running a CI job, I want my bare-override credentials
   to never leak into `~/.config/mb/config.yml`, so that subsequent runs
   on the same machine do not inherit them as defaults.
9. As an upgrading user, I want my existing `config.yml` to keep working
   without a manual migration step, so that the upgrade is invisible.
10. As an upgrading user, I want the CLI to print a one-line notice when
    it migrates my config, so that I know an automatic change happened
    and how to inspect it.
11. As a user creating a new Profile, I want to pass `--as <alias>` to
    name it during `auth login`, so that the Profile gets a meaningful
    name from the start.
12. As a user creating a new Profile, I want to omit `--as` and get a
    deterministic alias derived from the host, so that I am never forced
    to invent a name.
13. As a user, I want `auth login --as existing-alias` to fail unless I
    pass `--overwrite`, so that I do not clobber a Profile by accident.
14. As a user, I want `mb auth list` to show every Profile with its
    alias, instance URL, token type, username, and which one is active,
    so that I can audit my configuration at a glance.
15. As a security-conscious user, I want `mb auth list` to never print
    raw tokens, so that command output and shell history do not become
    credential dumps.
16. As a user switching defaults, I want `mb auth use <alias>` to set
    the Active Profile without making any network call, so that I can
    re-point my session offline.
17. As a user cleaning up, I want `mb auth rm <alias>` to delete a
    Profile from local config and, if it is a session-type Profile,
    invalidate the server-side session on a best-effort basis, so that I
    can both clean up locally and revoke tokens.
18. As a user, I want `mb auth logout` to revoke only the server-side
    session and leave my local Profile intact, so that I can
    deliberately end a session without losing the saved credentials.
19. As a user, I want `mb auth logout` on an API-key Profile to be a
    no-op (nothing to revoke server-side), so that the verb still works
    safely against any Profile type.
20. As a user passing `--profile prod --host other.com` simultaneously,
    I want a hard error explaining the conflict, so that I am never
    silently sent to the wrong place.
21. As a user, I want `--profile` to also be mutually exclusive with
    `--token`, `MB_HOST`, and `MB_TOKEN`, so that the rule "Profile is
    an atomic identity" is enforced consistently.
22. As an agent author, I want `_source` to always be a non-empty
    string, never `null` or absent, so that my type signatures and
    parsers stay simple.
23. As an agent author, I want bare-override invocations to emit
    `_source: "<host-key>"`, so that even Profile-less calls produce
    attributable output.
24. As a human reading stderr, I want a `// Source: <alias> (<url>)`
    notice on each command, so that I can see context without reading
    JSON.
25. As a human reading stderr, I want errors to be prefixed with
    `[<alias>] `, so that during multi-Profile loops I can immediately
    tell which source failed.
26. As a script author, I want `auth login --token-stdin` to read the
    token from stdin, so that the token never appears in shell history
    or process listings.
27. As a developer of the CLI, I want `config.yml` to carry a `version`
    field on the new shape, so that future schema migrations can be
    detected without sniffing individual fields.
28. As a power user, I want to query multiple Profiles by writing a
    shell loop and merging with `jq -s 'add'`, so that I do not need a
    built-in fan-out feature.
29. As a power user, I want the docs to include a fan-out shell recipe,
    so that I do not assume the missing built-in is an oversight.
30. As a user of `mb auth status`, I want it to default to the Active
    Profile and accept `--profile <alias>` to inspect any other one, so
    that auditing a specific Profile does not require switching to it.
31. As an agent integrator, I want existing `jq` pipelines that select
    named fields (`jq '.[] | {id, name}'`) to keep working unchanged,
    so that upgrading does not break my prompts.

## Implementation Decisions

### Domain model

The full glossary lives in `CONTEXT.md`. The load-bearing terms are
**Profile**, **Profile alias**, **Active Profile**, **Host key**,
**Profile selection**, and **Source attribution**. PR descriptions,
comments, and commit messages should use these terms.

### Architectural decisions

Three ADRs encode the load-bearing decisions; implementation must
respect them.

- **ADR 0001 — Profile as the identity primary index.** Profile
  replaces "current_host + per-host credentials". `_source` is always
  injected. `--profile` is mutually exclusive with `--host`/`--token`
  and their env-var equivalents. `logout` is redefined to revoke
  server-side sessions only.
- **ADR 0002 — Config migration and bare-override.** First read of a
  legacy config auto-migrates to the Profile shape. `MB_HOST` +
  `MB_TOKEN` is kept permanently as a Profile-less path, never
  persisted, never interacting with Profile-management commands.
- **ADR 0003 — No built-in fan-out in v1.** One Profile per
  invocation; multi-source is shell-driven (`for ... done | jq -s
  'add'`). `--profile` accepts a single alias; comma-separated lists
  are reserved syntax space.

### Profile alias rules

- Charset: `[a-zA-Z0-9_-]{1,32}`.
- Globally unique across the config.
- Case-sensitive in storage, but case-insensitive collision is
  rejected on create (`Prod` blocks `prod`).
- Reserved values that cannot be used as an alias: `current`,
  `default`, `@me`, `-`.
- When `auth login` is run without `--as`, an alias is derived from
  the Host key: replace `.`, `:`, `/` with `-`, trim, truncate to 32
  chars, suffix `-2`/`-3`/… on collision.

### Config schema (version 2)

The on-disk shape changes shape, not file location (`~/.config/mb/config.yml`):

```yaml
version: 2
current_profile: customer-a            # alias of the Active Profile, or null
profiles:
  customer-a:
    instance: https://mb.cust-a.com    # full base URL (was split into host_key + protocol)
    token: mb_xxx
    token_type: api_key
    username: foo@cust-a.com           # optional
    default_db: 1                      # optional
```

Legacy keys (`current_host`, `hosts`) are read once at first load,
migrated into the above shape, then left as empty stubs (`hosts: {}`,
`current_host: null`) for one release as a rollback hint. The `version`
field is the canonical signal for "schema is v2 already, skip
migration".

### Module changes (no file paths — refer by responsibility)

- **Config module**: gains `version`, `profiles`, `current_profile`;
  one-shot migration on legacy detection; deterministic alias
  derivation utility.
- **Auth module**: replaces `resolveToken` + `resolveHost` with a
  single `resolveProfile` that returns either a Profile descriptor or
  a `BareOverride` descriptor. Enforces the mutual-exclusion rule and
  raises a typed error when violated. The resolution chain is
  exactly: `--profile` → `MB_PROFILE` → bare (`--host`+`--token` or
  `MB_HOST`+`MB_TOKEN`) → Active Profile.
- **Auth commands**: verb set is `login --as <alias> [--overwrite]
  [--token-stdin]`, `list`, `use <alias>`, `rm <alias>`, `status
  [--profile <alias>]`, `logout`. `login` defaults `--as` from the
  derived alias. `logout` now sends `DELETE /api/session` only, never
  touches `config.yml`. Local removal is exclusively `rm`'s job.
- **Output module**: a single function injects `_source` into every
  record produced by any command. The value is the Profile alias on
  the Profile path, the Host key string on the bare-override path,
  always a non-empty string. The same module emits the `// Source:`
  stderr line and the `[<alias>] ` error prefix.
- **Global flag wiring**: `--profile <alias>` and `MB_PROFILE` are
  registered at the root command level alongside the existing
  `--host`/`--token`/`--format`/etc., and feed `resolveProfile`.

### CLI surface (what users see)

- `mb auth login --host <url> --token <t> [--as <alias>] [--overwrite]`
- `mb auth login --host <url> --username <u> --password <p> [--as
  <alias>] [--overwrite]`
- `mb auth login --host <url> --token-stdin [--as <alias>]
  [--overwrite]`
- `mb auth list`
- `mb auth use <alias>`
- `mb auth rm <alias>`
- `mb auth status [--profile <alias>]`
- `mb auth logout` — server-side session revoke only, on the Active
  Profile (or `--profile <alias>`)
- Any non-auth command additionally accepts `--profile <alias>`.

### `auth list` output shape

```json
[
  {
    "_source": "customer-a",
    "alias": "customer-a",
    "instance": "https://mb.cust-a.com",
    "tokenType": "api_key",
    "username": "foo@cust-a.com",
    "active": true
  }
]
```

Token values are never present in any output. `table`/`csv` formats
mirror this — the token column does not exist, not even as `***`.

### Error contract

- `--profile <alias>` combined with any of `--host`, `--token`,
  `MB_HOST`, `MB_TOKEN` on the same invocation: exit 1, stderr message
  names both conflicting sources.
- `auth login --as <existing-alias>` without `--overwrite`: exit 1,
  stderr message suggests the `--overwrite` flag.
- `--profile <unknown>`: exit 1, stderr lists known aliases.
- Errors continue to go to stderr with exit code 1, now prefixed with
  `[<alias-or-host-key>] `.

## Testing Decisions

### What makes a good test here

Test external behaviour through the highest seam practical: what the
user observes in stdout, stderr, `~/.config/mb/config.yml`, and the
HTTP requests the CLI emits. Do not assert on internal function call
counts, module-level state, or specific log strings beyond stable
markers (`// Source:`, `[<alias>]`). Tests should survive an internal
refactor.

### Seams

Three seams, in priority order. The first two reuse existing patterns
in the repo; only one is genuinely new.

**Seam 1 — Command-level black-box** (`tests/commands/*.test.ts`
pattern, prior art: `auth.test.ts`, `query.test.ts`). Stub `HOME`,
invoke the exported command handler, assert against the resulting
`config.yml` contents, the captured `fetch` calls (`mockFetch`), and
the stdout/stderr produced. This seam carries the bulk of the
verification load. Covers:

- Profile creation via `auth login --as` (storage shape, `version: 2`,
  alias rules, collision handling, `--overwrite`).
- Auto-migration of a pre-seeded legacy `config.yml`.
- Each new verb (`list`, `use`, `rm`, `status [--profile]`).
- `logout` revoking the server-side session but leaving the Profile
  on disk.
- Mutual-exclusion errors and unknown-alias errors.
- `auth list` never containing token values.
- A representative non-auth command (`query` or `db list`) honouring
  `--profile` / `MB_PROFILE` and emitting `_source` in stdout records.

**Seam 2 — Profile resolution** (`tests/lib/auth.test.ts` pattern,
prior art exists for `resolveToken`). Table-driven unit tests over
`resolveProfile`: every combination of `--profile`, `MB_PROFILE`,
bare-override env, Active Profile, with the expected winner or
expected mutual-exclusion error. The four-input combinatorial space
is uneconomical at the command level — keep it here.

**Seam 3 — `_source` injection** (small new unit test, lives under
`tests/lib/`). One function takes `(records, sourceId)` and returns
records with `_source` set; it must never overwrite an existing
`_source` field on a record, must produce a string for every record,
and must accept an empty array. Independent test because this
function is the single chokepoint for ADR 0001's most easily-broken
invariant; command-level tests sample its effect but do not
exhaustively cover it.

### Modules tested

- Command handlers under `src/commands/auth/*` and one representative
  non-auth command — Seam 1.
- `resolveProfile` in `src/lib/auth.ts` — Seam 2.
- `_source` injection helper (new, location TBD between
  `src/lib/formatter.ts` and `src/lib/agent-projections.ts`) — Seam 3.

### Out of test scope

- `src/lib/api-client.ts` — Profile work does not change request
  shapes; existing tests continue to apply unchanged.
- `loadConfig` / `saveConfig` low-level IO — already covered;
  migration is verified at Seam 1 via observable behaviour, not by
  unit-testing the migration function directly.
- Exact stderr text formatting — assert presence of stable markers
  only.

## Out of Scope

- **Built-in fan-out across Profiles.** See ADR 0003. Shell loops +
  `jq -s 'add'` are the documented pattern. `--profile a,b,c` syntax
  is reserved but unimplemented.
- **`mb auth rename <old> <new>`.** Covered by `auth rm` + `auth login
  --as`; not worth a dedicated verb.
- **OAuth or SSO flows.** This PRD strictly preserves the existing
  authentication mechanisms (API key, password → session). New auth
  methods are a separate effort.
- **Per-Profile output preferences** (e.g. defaulting `--format csv`
  for one Profile). Output flags remain global.
- **Sharing Profiles between machines** (export/import). Out of scope.
- **A `version: 3` schema.** The `version` field exists precisely so
  this can be a separate future effort; not part of this work.
- **Removing the bare-override path.** ADR 0002 makes it permanent.
- **Library / programmatic API.** The CLI is the contract.

## Further Notes

- The agent skill definition (`skill.md`) and `README.md`
  authentication section must be rewritten so that Profile is the
  primary narrative; the bare-override path is mentioned as the
  escape hatch, not the default story.
- The orthogonality between bare-override env vars and Profile-
  management commands is the single most likely source of user
  confusion. The documentation should state it explicitly: "Profile
  management commands act on `~/.config/mb/config.yml`, not on
  environment variables. Environment variables decide which identity
  a single command runs as; the config file is the inventory of
  Profiles you can pick from."
- The decisions captured here resolve the `grill-with-docs` session
  that produced `CONTEXT.md` and ADRs 0001/0002/0003. Future
  contributors revisiting any of these decisions should update the
  ADR (mark `superseded by ADR-NNNN`) rather than the PRD.
- Several small decisions are deliberately deferred to implementation
  time, with a noted lean: (a) `default_db` migrates onto the
  Profile, not shared across Profiles on the same Instance; (b)
  fallback alias derivation uses Host key only, never `username`; (c)
  `auth list --format table` omits the token column entirely rather
  than masking it.
