---
name: metabase
description: Query data from Metabase databases. Use when the user needs to query business databases, run SQL, view saved reports, or explore database structure via Metabase. Make sure to use this skill whenever the user mentions Metabase, business data queries, saved questions/cards, database schema exploration, or wants to run SQL against a BI platform, even if they don't explicitly say "metabase".
---

# Metabase CLI (`mb`)

Query Metabase databases from the terminal. JSON results go to stdout; select
`--error-format json` (or `MB_ERROR_FORMAT=json`) for structured failures on
stderr. Use `mb schema <command...>` to discover accepted inputs and output
contracts without authentication or network access.

## Installation

Requires Node.js >= 20.

### Global Install (Recommended)

```bash
npm install -g @pikaskill/metabase-cli
```

After installation, the `mb` command is available globally:

```bash
mb --version
mb --help
```

### One-off Execution via npx

No installation needed — run directly:

```bash
npx @pikaskill/metabase-cli --help
npx @pikaskill/metabase-cli db list
npx @pikaskill/metabase-cli query "SELECT 1" --db 1
```

### Uninstall

```bash
npm uninstall -g @pikaskill/metabase-cli
```

To also remove the config file:

```bash
# Linux/macOS
rm -rf ~/.config/mb

# Windows
rmdir /s /q %USERPROFILE%\.config\mb
```

## Prerequisites

Configure authentication by creating one or more **Profiles**. A Profile alias
names one Metabase instance plus one set of credentials. The Active Profile is
used when a command does not pass `--profile`.

```bash
mb auth login --host https://metabase.example.com --token mb_xxxx --as prod
mb auth login --host https://staging.example.com --username user@co.com --password secret --as staging
mb auth list
mb auth use prod
```

For one-off scripts, use the bare override path without creating a Profile:

```bash
MB_HOST=https://metabase.example.com MB_TOKEN=mb_xxxx mb db list
mb db list --host https://metabase.example.com --token mb_xxxx
```

Always supply both a host and token for a bare override. Incomplete overrides
fail without falling back to the Active Profile. For bare SQL queries, also
supply `--db` or `MB_DEFAULT_DB`; saved Profile defaults do not apply.

Profile management commands act on `~/.config/mb/config.yml`, not on
environment variables. Environment variables decide which identity a single
command runs as; the config file is the inventory of Profiles you can pick from.

`auth status` inspects saved credentials locally; it does not verify the token
with Metabase. It accepts `--profile`/`MB_PROFILE`, ignores bare-override
environment variables, and rejects explicit `--host`/`--token`.

## Commands

### Authentication
| Command | Description |
|---------|-------------|
| `mb auth login --host <url> --token <key> --as <alias>` | Create an API-key Profile |
| `mb auth login --host <url> --username <u> --password <p> --as <alias>` | Create a session Profile |
| `mb auth login --host <url> --token-stdin --as <alias>` | Read token from stdin |
| `mb auth list` | List Profiles; tokens are never printed |
| `mb auth use <alias>` | Set the Active Profile offline |
| `mb auth rm <alias>` | Remove a local Profile; session revoke is best effort |
| `mb auth status [--profile <alias>]` | Show Active or selected Profile auth state |
| `mb auth check [--profile <alias>]` | Verify authentication and database-list access online |
| `mb auth set-default-db <id> [--profile <alias>]` | Set a saved Profile's default database offline, preserving the Active Profile |
| `mb auth logout [--profile <alias>]` | Revoke server-side session only; keep the Profile |

### Database Exploration
| Command | Description |
|---------|-------------|
| `mb db list` | List all databases |
| `mb db schemas <db-id>` | List schemas in a database |
| `mb db tables <db-id> [--schema <name>]` | List tables |
| `mb db fields <table-id>` | List table fields (name, type, description) |
| `mb db metadata <db-id>` | Full database metadata |
| `mb db schema <db-id> [--schema <name>] [--tables <names>]` | Compact field types, descriptions, and declared key relationships in one request |

### Query Execution
| Command | Description |
|---------|-------------|
| `mb query "<sql>" --db <id>` | Execute native SQL |
| `mb query --file <path\|-> --db <id>` | Read literal SQL from a file or piped stdin |
| `mb card list [--collection <id>]` | List saved cards |
| `mb card create --name <name> --database <id> --sql "<sql>"` | Create a native SQL card |
| `mb card create --from <file>` | Create a card from a JSON payload file |
| `mb card create --name <name> --db <id> --sql-file <path\|->` | Create from a SQL file or stdin; `--db` is an alias for `--database` |
| `mb card view <card-id>` | View card definition, parameters, and template tags |
| `mb card run <card-id> [--params '{"key":"val"}']` | Run saved card (uses `card.parameters`) |
| `mb card run <card-id> [--template-tags '{"key":"val"}']` | Run native SQL card (uses template tags) |
| `mb card run <card-id> --params-file <path\|->` | Read parameter JSON from a file or stdin |
| `mb card run <card-id> --template-tags-file <path\|->` | Read template-tag JSON from a file or stdin |
| `mb card update <card-id> [--name ...] [--description ...] [--collection <id>] [--sql "<sql>"]` | Safely update a card via fetch-then-merge |
| `mb card update <card-id> --from <file>` | Apply a JSON patch file to an existing card |
| `mb card update <card-id> --sql-file <path\|->` | Update a native Card from literal SQL file or stdin |
| `mb card delete <card-id>` | Archive a card (safe default) |
| `mb card delete <card-id> --hard-delete` | Permanently delete a card |
| `mb card archive <card-id>` | Explicit archive alias |

### Search & Browse
| Command | Description |
|---------|-------------|
| `mb search <query> [--type card\|dashboard\|collection\|table]` | Search Metabase |
| `mb collection list [--parent <id>]` | List collections |
| `mb collection view <id>` | View collection contents |

### Global Flags
All commands support: `--profile <alias>`, `--format json|csv|table` (default: json), `--json <fields>`, `--jmespath <expr>`, `--no-header`.

Use `--error-format json` for stable errors. HTTP controls are `--timeout <ms>`
(default 30000), `--deadline <ms>` (default 120000 total HTTP budget), and
`--retries <n>` (default 2, range 0–5); their environment equivalents are
`MB_TIMEOUT`, `MB_DEADLINE`, and `MB_RETRIES`. Only GET requests are retried for
transient failures. The transport honors Retry-After within its delay/budget
limits. SQL POSTs and writes are not repeated for transient failures. A request
rejected with 401 may be replayed once after session renewal, sharing the budget.

`--jq` remains a legacy alias for `--jmespath`; both use **JMESPath syntax**, such
as `'[].name'`, not jq's `'.[].name'`. Use only one alias per invocation. Invalid
expressions fail before a request is sent; transformed results are always JSON.

`MB_PROFILE=<alias>` is equivalent to `--profile <alias>` for one invocation.
Do not combine `--profile`/`MB_PROFILE` with `--host`, `--token`, `MB_HOST`, or
`MB_TOKEN`; a Profile is an atomic identity.

`query` and `card run` also support `--limit <n>` (default: 100) and
`--offset <n>` (default: 0) for **local output slicing**. Each invocation submits
the query again and downloads its response before slicing; these flags do not
limit database execution or resume a stable result snapshot. If Metabase reports
truncation, omitted rows cannot be recovered by increasing `--offset`.

## Recommended Workflow

1. `mb schema query` — inspect a command contract when its interface is unknown;
   request a specific command to minimize discovery output.
2. `mb auth check --profile <alias>` — verify connectivity and database-list
   access when needed; this does not prove access to every table or query.
3. `mb db list --profile <alias>` — discover databases, then
   `mb db schema <db-id> --tables <names> --profile <alias>` to get relevant field
   types and declared relationships. Names may be schema-qualified or table IDs.
4. `mb query --file query.sql --db <id> --profile <alias> --error-format json` —
   execute literal SQL. For short queries, positional SQL still works.
5. For large results, narrow the SQL with filters, deterministic ordering, and
   suitable SQL limits. Use `--offset` only when intentionally rerunning a query
   to inspect a different local slice; the result may have changed.

Use explicit `--profile` per invocation when agents operate concurrently; avoid
switching shared Active Profile state. `auth set-default-db <id> --profile <alias>`
can save a default offline; `--db` and `MB_DEFAULT_DB` override it. Metadata is
not a permission guarantee: `fields_available: false` means fields were not
returned, not that the table has no columns. Missing relationship targets retain
field IDs and must not be guessed. Filters on `db schema` reduce output locally;
`db tables` omits fields from its unfiltered metadata request.

Prefer SQL/JSON files or piped stdin over deeply escaped command strings. Input
must be nonempty UTF-8 and at most 16 MiB. Use `--file -`, `--sql-file -`,
`--params-file -`, `--template-tags-file -`, or `--from -` explicitly for stdin.
Interactive stdin and conflicting sources are rejected before API requests.
Choose only one Card parameter source, and only one of `--db`/`--database`.

Or find existing reports:
1. `mb search "<keyword>"` — find saved cards/dashboards
2. `mb card view <id>` — check parameters and template tags
3. `mb card run <id> --params '{"key":"value"}'` — execute with parameters
4. `mb card run <id> --template-tags '{"key":"value"}'` — execute native SQL card with template tags

### Template Tags vs Parameters

Native SQL cards use **template tags** (e.g. `{{biz_type}}` in SQL). These are stored in `dataset_query.native["template-tags"]`, not in `card.parameters`.

- Use `--params` when `card view` shows entries in `parameters`
- Use `--template-tags` when `card view` shows entries in `template_tags` (and `parameters` is empty)

## Card Write Operations

### Create cards

```bash
mb card create --name "My Query" --database 1 --sql "SELECT 1"
mb card create --from card.json
```

`--from` cannot be combined with inline create flags.

### Update cards

```bash
mb card update 123 --name "New Name"
mb card update 123 --sql "SELECT * FROM orders LIMIT 10"
mb card update 123 --from patch.json
```

`mb card update` uses fetch-then-merge: it reads the current card first, applies your patch, and preserves unspecified required fields such as `dataset_query`, `display`, and `visualization_settings`.

Inline `--sql` only supports native-query cards. Use `--from` for non-native or more complex updates.

### Delete and archive cards

```bash
mb card delete 123
mb card archive 123
mb card delete 123 --hard-delete
```

`mb card delete` archives by default, `mb card archive` is the explicit alias for that safe path, and `--hard-delete` is irreversible.

## Output

- Default output is JSON (array of objects), ideal for AI parsing
- Duplicate query column names receive collision-free numeric suffixes:
  `id, id, id_2` becomes `id, id_3, id_2`. Use explicit SQL aliases when possible.
- Every JSON record carries `_source`: the Profile alias, or the Host key for
  bare override calls. `--json` retains it. Conflicting business columns are
  preserved under a free suffix such as `_source_2`.
- Explicit JMESPath expressions own their output shape and may omit `_source`
  or return scalars. Include `_source` in projections used to merge sources.
  An unauthenticated `auth status` and offline `mb schema` have no source to attribute.
- stderr includes `// Source: <alias-or-host-key> (<url>)`
- Pagination info goes to stderr, e.g.: `// Showing rows 1-100 of 1523`
- Errors go to stderr with exit code 1. Text errors are prefixed with `[source]`.
  With `--error-format json`, parse the final error line as JSON (earlier
  diagnostics may precede it): `code`, `message`, `retryable`, `hint`, and optional
  `http_status`/`source`. Fix `INVALID_INPUT` locally; authenticate for
  `AUTHENTICATION_REQUIRED`; do not automatically repeat writes marked
  `retryable: false`—verify their outcome first.
- Successful auth changes, archive, and delete return operation receipts on
  stdout. An API-key logout does not revoke the key. Local Profile removal can
  succeed while server revocation fails; inspect the receipt's revocation status.

`mb schema [command...]` and the generated [command reference](./docs/commands.md)
describe current options, conflicts, effects, examples, and JSON schemas. Explicit
JMESPath transforms may change the documented default output shape. SQL execution
commands are not assumed read-only; their effects depend on SQL and permissions.

Built-in fan-out across Profiles is intentionally absent. Use a shell loop and
merge the already-attributed JSON:

```bash
for p in customer-a customer-b customer-c; do
  mb query "SELECT * FROM orders LIMIT 10" --db 1 --profile "$p"
done | jq -s 'add'
```
