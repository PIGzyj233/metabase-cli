---
status: proposed
---

# 0001 — Profile as the identity primary index

## Decision

Replace the implicit "config.current_host + per-host credentials" model with
**Profile**: a user-named binding of one Metabase Instance URL to one set of
credentials. Profile alias becomes the primary handle users (and AI agents)
reference when invoking commands; Host key is demoted to an internal storage
detail. Every stdout record carries a `_source` field naming the Profile (or
the Host key, when the bare-override path is used) so multi-source output is
self-attributing.

## Why

The original model assumed one credential per Host key and silently overwrote
on re-login. That cannot express "two accounts on the same Metabase" and forces
agents to mentally track which Host is currently active. Profiles model the
real concept users hold in their heads — "customer A", "prod read-only",
"staging admin" — and let a single CLI invocation pick any of them via
`--profile <alias>` or `MB_PROFILE` without a stateful switch.

`_source` injection is part of the same decision rather than an output-layer
detail, because the value proposition collapses without it: an agent fanning
out across three Profiles must be able to attribute each row to its origin
purely from stdout.

## Considered options

- **Alias as host nickname only, one credential per host.** Rejected — does not
  express multi-account-per-host, the central motivating case.
- **Alias as credential, host kept independent.** Rejected — over-normalised;
  forces users to combine a host pick and a credential pick on every command.
- **`--profile` selects host but `--token` may still override credentials.**
  Rejected — breaks the Profile-as-atomic-aggregate invariant; partial
  overrides make "what am I connected to?" unreadable.
- **`--with-source` flag, off by default.** Rejected — leaves two output
  schemas in the wild and re-introduces the very ambiguity Profiles exist to
  remove. Always-on `_source` is the cleaner contract.
- **Object-shaped `_source: {profile, instance}` per row.** Rejected as
  default — bloats every record with a URL that is stable per invocation and
  recoverable via `mb auth status --profile <alias>`.

## Consequences

- `config.yml` schema gains a `profiles` map keyed by alias and a
  `current_profile` field. `current_host` and the implicit per-host credential
  shape are deprecated; migration is one-shot on first read.
- README's "JSON output is an array of objects" promise is amended to "…each
  carrying a `_source` string field". Existing `jq` pipelines that project
  named fields keep working; pipelines that enumerate full record schemas need
  to acknowledge `_source`.
- `--profile` and `--host`/`--token`/`MB_HOST`/`MB_TOKEN` become mutually
  exclusive on the same invocation; supplying both is a hard error, not a
  silent precedence resolution.
- `mb auth logout` is redefined to mean "invalidate the server-side session
  only, leave the local Profile intact". Local removal moves to `mb auth rm
  <alias>`. This is a behavioural change for session-type Profiles (API-key
  Profiles are unaffected, since they had no server-side session to revoke).
- A new verb set lands under `mb auth`: `login --as <alias>`, `list`, `use
  <alias>`, `rm <alias>`, `status [--profile <alias>]`. `rename` is
  intentionally omitted — `rm` + re-`login --as` covers it.
