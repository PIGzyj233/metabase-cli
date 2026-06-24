// CONTEXT.md
# metabase-cli

A terminal CLI for querying Metabase, designed for AI agents. This document is
the project glossary — it pins down terminology so the CLI, docs, and agent
skills all speak the same language.

## Language

**Profile**:
A named binding of one Metabase instance URL to one set of credentials
(API key or session token, plus optional username). The unit users
authenticate, switch between, and reference by alias.
_Avoid_: account, environment, connection, alias-of-host

**Instance**:
A single Metabase deployment, identified by its base URL (scheme + host +
optional path prefix). One instance can be the target of multiple Profiles
(e.g. different accounts on the same Metabase).
_Avoid_: server, site, host-as-deployment

**Host key**:
The normalized `host[:port][/path]` string used as the storage key for an
instance in `config.yml`. A pure identifier — never the thing a user types
to pick a Profile.
_Avoid_: hostname, server name

**Profile alias**:
The user-chosen identifier for a Profile. Matches `[a-zA-Z0-9_-]{1,32}`,
case-sensitive but case-collision-rejecting on create, globally unique
across the config. Reserved: `current`, `default`, `@me`, `-`.
_Avoid_: profile name, label, tag

**Active Profile**:
The Profile used when no explicit selection is made on a command. Set by
the most recent successful `auth login` or `auth use`. Any command can
override it for a single invocation via explicit selection (e.g.
`--profile <alias>`).
_Avoid_: current host, default account, logged-in user

**Profile selection**:
The resolution chain that decides which Profile a command runs against,
in order: `--profile <alias>` → `MB_PROFILE` → bare `--host` + `--token`
(or `MB_HOST` + `MB_TOKEN`, a Profile-less override) → Active Profile.
`--profile` is mutually exclusive with `--host` / `--token` / `MB_HOST` /
`MB_TOKEN` on the same invocation.
_Avoid_: profile lookup, auth resolution

**Source attribution**:
Every record in stdout JSON output carries a `_source` field. Single mode,
always on, no flag. For Profile-driven invocations the value is the
Profile alias; for the bare-override path (no Profile) the value is the
Host key string. The field is always a non-empty string — never `null`,
never absent. stderr additionally carries a human-readable
`// Source: <alias-or-host-key> (<base-url>)` line and prefixes errors
with `[<alias-or-host-key>] `.
_Avoid_: source tag, origin marker
