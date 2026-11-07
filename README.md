# metabase-cli

> Query Metabase databases from the terminal. Designed for AI agents.

[![npm](https://img.shields.io/npm/v/@pikaskill/metabase-cli)](https://www.npmjs.com/package/@pikaskill/metabase-cli)
[![license](https://img.shields.io/npm/l/@pikaskill/metabase-cli)](https://github.com/PIGzyj233/metabase-cli/blob/main/LICENSE)

## Install

```bash
# Global install
npm install -g @pikaskill/metabase-cli

# Or run without installing
npx @pikaskill/metabase-cli <command>
```

Requires Node.js >= 20.

## Quick Start

```bash
# 1. Create a named Profile
mb auth login --host https://metabase.example.com --token mb_xxxx --as prod

# 2. Explore databases through the Active Profile
mb db list
mb db tables 1
mb db fields 42
mb db schema 1 --tables public.orders,public.customers

# 3. Query data, or target another Profile for one command
mb query "SELECT * FROM orders LIMIT 10" --db 1
mb query "SELECT * FROM orders LIMIT 10" --db 1 --profile staging

# 4. Run saved cards
mb card list
mb card run 123 --params '{"date":"2026-01-01"}'

# 5. Verify access, save a Profile-specific default, and run a SQL file
mb auth check --profile prod
mb auth set-default-db 1 --profile prod
mb query --file report.sql --profile prod --error-format json
```

## Authentication

Authentication is organized around **Profiles**: a Profile alias names one
Metabase instance plus one set of credentials. The most recent successful
`auth login` or `auth use` sets the Active Profile used by commands that do not
pass `--profile`.

| Command | Purpose |
|---------|---------|
| `mb auth login --host <url> --token mb_xxxx --as <alias>` | Create an API-key Profile |
| `mb auth login --host <url> --username <u> --password <p> --as <alias>` | Create a session Profile |
| `mb auth login --host <url> --token-stdin --as <alias>` | Read the token from stdin |
| `mb auth list` | List Profiles without printing token values |
| `mb auth use <alias>` | Set the Active Profile without a network call |
| `mb auth rm <alias>` | Remove a local Profile; session revoke is best effort |
| `mb auth status [--profile <alias>]` | Inspect the Active or selected Profile |
| `mb auth check [--profile <alias>]` | Verify authentication and database-list access over HTTP |
| `mb auth set-default-db <id> [--profile <alias>]` | Save a default database locally without switching the Active Profile |
| `mb auth logout [--profile <alias>]` | Revoke only the server-side session; keep the Profile |

Credentials are saved as Profiles in `~/.config/mb/config.yml`.

`--host <url>` is the base URL of your Metabase instance, for example
`https://metabase.example.com` or `metabase.example.com`. If the protocol is
omitted, `https://` is used.

For one-shot scripts and CI, you can use the bare override path without
creating a Profile:

```bash
MB_HOST=https://metabase.example.com MB_TOKEN=mb_xxxx mb db list
mb db list --host https://metabase.example.com --token mb_xxxx
```

Bare overrides require both a host and token; an incomplete override is an
error and never falls back to the Active Profile. A bare query also needs
`--db` or `MB_DEFAULT_DB`; it does not inherit a saved Profile's database ID.

Profile management commands act on `~/.config/mb/config.yml`, not on
environment variables. Environment variables decide which identity a single
command runs as; the config file is the inventory of Profiles you can pick from.

`auth status` inspects saved credentials locally, not whether a token is valid on
the server. It accepts `--profile`/`MB_PROFILE`, ignores bare-override environment
variables, and rejects explicit `--host`/`--token`.

Use `auth check` for an online check. It reports `reachable`, `authenticated`,
`database_count`, and `elapsed_ms`, or exits nonzero with an error. Successful
database-list access does not establish permission to run every query.
`auth set-default-db` is an offline Profile operation; it does not verify the
database ID on the server. Explicit `--db` and `MB_DEFAULT_DB` still override a
Profile's saved default.

## Commands

```bash
mb schema                 # Discover the command tree and machine-readable contracts
mb schema query           # Inspect one command, including inherited options
mb schema card create
```

The [command reference](./docs/commands.md) is generated from the same command
definitions as CLI help. It covers authentication, database exploration, SQL,
Card reads and writes, search, and collections. `mb schema` works offline and
does not need credentials. It includes input types, defaults, conflicts,
examples, effects, and references to default JSON output/error schemas.

### SQL and JSON input

```bash
mb query --file report.sql --db 1
cat report.sql | mb query --file - --db 1
mb card create --name Revenue --db 1 --sql-file report.sql
mb card update 123 --sql-file report.sql
cat card.json | mb card create --from -
cat patch.json | mb card update 123 --from -
mb card run 123 --params-file params.json
cat tags.json | mb card run 123 --template-tags-file -
```

Files and stdin must contain nonempty UTF-8 text, at most 16 MiB. SQL is sent
literally, without interpolation. `-` explicitly selects piped stdin; interactive
stdin is rejected. Choose one SQL input or JSON payload source per command and
one parameter source per Card run. `card create --db` is an alias for
`--database`; do not pass both. JSON files must contain objects and are checked
before network access, including Card update patches.

### Compact database exploration

`db tables` requests metadata with `skip_fields=true` when listing all tables.
`db schema <id>` makes one metadata request and emits a compact database
description with engine, table descriptions, field types, semantic types, and
declared primary/foreign keys. It does not infer relationships from names.
`--tables` accepts comma-separated names, schema-qualified names, or table IDs;
ambiguous names require a schema or ID. `--schema` and `--tables` filter the
output locally. `fields_available: false` means fields were not returned, for
example due to permissions; it does not mean the physical table has no columns.
Unknown foreign-key targets retain their field IDs without guessed table names.

### Global Flags

| Flag | Description |
|------|-------------|
| `--format json\|csv\|table` | Output format (default: json) |
| `--json <fields>` | Select specific JSON fields |
| `--jmespath <expr>` | JMESPath filter expression, e.g. `'[].name'` |
| `--jq <expr>` | Legacy alias for `--jmespath`; uses JMESPath, not jq syntax |
| `--no-header` | Omit header in table/CSV output |
| `--host <url>` | Override Metabase URL |
| `--token <value>` | Override auth token |
| `--profile <alias>` | Select a Profile for one invocation |
| `--error-format text\|json` | Error format (default: text; environment: `MB_ERROR_FORMAT`) |
| `--timeout <ms>` | Per-request HTTP timeout, including body reads (default: 30000; `MB_TIMEOUT`) |
| `--deadline <ms>` | Total HTTP budget across requests, retries, and renewal (default: 120000; `MB_DEADLINE`) |
| `--retries <n>` | Additional transient GET attempts, 0–5 (default: 2; `MB_RETRIES`) |

Use only one of `--jmespath` and `--jq`. Expressions are validated before a
request is sent, and their result is always emitted as JSON.

`MB_PROFILE=<alias>` is equivalent to passing `--profile <alias>` for a single
command. `--profile`/`MB_PROFILE` cannot be combined with `--host`, `--token`,
`MB_HOST`, or `MB_TOKEN` because a Profile is an atomic identity.

Transient retries apply only to GET requests on network/time-out failures and
HTTP 429/502/503/504. Backoff respects `Retry-After`; delays longer than 30 seconds
or the remaining budget stop retries instead of retrying early. SQL execution
POSTs and writes are not repeated for transient failures. Existing session
renewal may replay a request rejected with 401 once, within the same HTTP budget.

## Output

`query` and `card run` accept `--limit` (default 100) and `--offset` (default
0) to slice the rows returned by Metabase **locally**. These flags do not limit
database execution or network transfer. Each invocation submits the query again;
changing `--offset` does not resume a stable result snapshot. For large native
queries, put appropriate filtering, ordering, and limits in your SQL. If Metabase
reports truncation, stderr warns that omitted rows cannot be recovered with
`--offset`.

- JSON by default (array of objects) — ideal for AI agent parsing
- Duplicate query column names get deterministic numeric suffixes without
  overwriting real column names: `id, id, id_2` becomes `id, id_3, id_2`.
- Every JSON record includes `_source`: the Profile alias, or the Host key for
  bare override calls. `--json` retains it. A business column named `_source` is
  preserved under a free suffix such as `_source_2`.
- Explicit JMESPath expressions control the output shape, including scalars or
  objects without `_source`. Include `_source` in projections when merging data.
  An unauthenticated `auth status` and offline `mb schema` have no source to attribute.
- stderr includes `// Source: <alias-or-host-key> (<url>)`
- Pagination info goes to stderr: `// Showing rows 1-100 of 1523`
- Errors go to stderr with exit code 1; text mode prefixes them with `[source]`
- `--error-format json` emits an error record with stable `code`, `message`,
  `retryable`, and `hint`, plus `http_status` and `source` when available.
  Earlier diagnostic lines may be present; the final error line is JSON.

For example:

```json
{"code":"PERMISSION_DENIED","message":"Forbidden","http_status":403,"retryable":false,"hint":"Use a Profile permitted to access this resource.","source":"prod"}
```

`retryable: false` on failed writes means an agent should verify the outcome
before attempting another write. Successful authentication changes, Card
archiving, and deletion emit JSON operation receipts; credentials are excluded.

Built-in fan-out across Profiles is intentionally absent. Use the shell and
merge the already-attributed JSON:

```bash
for p in customer-a customer-b customer-c; do
  mb query "SELECT * FROM orders LIMIT 10" --db 1 --profile "$p"
done | jq -s 'add'
```

## Uninstall

```bash
npm uninstall -g @pikaskill/metabase-cli

# Optional: remove config
rm -rf ~/.config/mb
```

## AI Agent Integration

This CLI is designed as a tool for AI agents (Claude, GPT, etc.). See [`skill.md`](./skill.md) for the agent skill definition.

For contributors, regenerate the command reference with `pnpm docs:commands`.
`pnpm docs:check` verifies it matches the CLI; publishing also runs this check.

## License

MIT
