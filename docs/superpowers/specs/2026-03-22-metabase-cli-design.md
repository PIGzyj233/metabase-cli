# Metabase CLI (`mb`) — Design Specification

## Overview

A terminal-based CLI tool for querying data from Metabase, designed primarily for AI agent consumption. Follows the `gh` (GitHub CLI) design pattern: `mb <entity> <action>`. Distributed as a reusable skill that AI agents load on demand.

## Goals

1. Enable AI agents to query Metabase databases via native SQL
2. Enable AI agents to execute saved Cards/Questions with parameters
3. Provide database metadata exploration (databases, schemas, tables, fields)
4. Provide search and collection browsing capabilities
5. Support both long-lived API keys and password-based session tokens with auto-renewal
6. Output structured data (JSON default) that AI agents can parse and reason about

## Non-Goals

- No dashboard creation/editing
- No user/permission management
- No interactive REPL mode
- No Metabase administration features

---

## Command Reference

### Authentication

```bash
mb auth login                          # Interactive: prompt for username/password
mb auth login --token <api-key>        # Configure long-lived API key
mb auth login --username <u> --password <p>  # Non-interactive password login
mb auth status                         # Show current auth state
mb auth logout                         # Clear stored credentials
```

### Database Metadata

```bash
mb db list                             # List all databases
mb db schemas <db-id>                  # List schemas in a database
mb db tables <db-id> [--schema <name>] # List tables (optionally filtered by schema)
mb db fields <table-id>                # List fields of a table (name, type, description)
mb db metadata <db-id>                 # Full database metadata dump
```

### Query Execution

```bash
mb query "<sql>" --db <id>             # Execute native SQL query
  [--limit 100]                        # Max rows returned (default: 100, client-side truncation)
  [--offset 0]                         # Row offset for pagination (client-side)
  [--format json|csv|table]            # Output format (default: json)
  [--json <fields>]                    # Select specific JSON fields (gh-style)
  [--jq <expr>]                        # Filter output with jmespath expression
```

### Card (Saved Questions)

```bash
mb card list                           # List all cards (GET /api/card)
  [--collection <id>]                  # Filter by collection (uses /api/collection/{id}/items?models=card)
mb card view <card-id>                 # View card definition (query, parameters, parameter schema)
mb card run <card-id>                  # Execute a saved card
  [--limit 100] [--offset 0]
  [--format json|csv|table]
  [--params '{"key": "value"}']        # Parameters as key-value pairs (see Parameter Resolution below)
```

### Search

```bash
mb search <query>                      # Full-text search across Metabase
  [--type card|dashboard|collection|table]  # Filter by entity type
```

### Collections

```bash
mb collection list [--parent <id>]     # List collections (root or under parent)
mb collection view <id>                # View collection contents
```

### Global Flags

Every command supports:

| Flag | Description |
|------|-------------|
| `--host <url>` | Override Metabase server URL |
| `--token <value>` | Override authentication token |
| `--format json\|csv\|table` | Output format (default: json) |
| `--json <fields>` | Select specific fields in JSON output |
| `--jq <expr>` | Filter JSON output with jmespath expression |
| `--no-header` | Omit header row in table/CSV output |
| `--help` | Show help for the command |

---

## Authentication

### Token Types

1. **API Key** — Long-lived, created in Metabase admin. Sent as `X-Api-Key` header.
2. **Session Token** — Temporary, obtained via `POST /api/session` with username/password. Sent as `X-Metabase-Session` header.

### Priority (highest to lowest)

1. `--token` command-line argument
2. `MB_TOKEN` environment variable (API key) or `MB_SESSION_TOKEN`
3. Token stored in config file
4. `MB_USERNAME` + `MB_PASSWORD` environment variables → auto-login

### Auto-Renewal

When a request returns HTTP 401:

1. Check if username/password credentials are available via `MB_USERNAME` + `MB_PASSWORD` environment variables
2. If yes: call `POST /api/session` to obtain a new session token
3. Update stored token in config file
4. Retry the original request (once)
5. If no credentials available: exit with error suggesting `mb auth login`

### Token Type Detection

When a token is provided via `--token` or `MB_TOKEN`, the CLI determines the header to use:

- If the config file has `token_type` for the current host, use that.
- If the token starts with `mb_` prefix, treat as API key (`X-Api-Key`).
- Otherwise, treat as session token (`X-Metabase-Session`).
- `MB_SESSION_TOKEN` env var is always treated as session token.

### HTTP Headers

- API Key auth: `X-Api-Key: <token>`
- Session auth: `X-Metabase-Session: <token>`

### Parameter Resolution for Card Execution

`--params '{"key": "value"}'` accepts a simple key-value JSON object. The CLI resolves parameters as follows:

1. Fetch card definition via `GET /api/card/{id}` to get the `parameters` array
2. For each key in `--params`, find the matching parameter by `slug` or `name`
3. Construct the Metabase-format parameter array: `[{id, type, target, value}]`
4. If a key doesn't match any parameter, exit with error listing available parameter names

This means users (and AI agents) only need to know the parameter name/slug, not the internal Metabase parameter structure.

---

## Configuration

### Config File Location

`~/.config/mb/config.yml` (follows XDG convention, cross-platform via `env.HOME`)

### Config File Format

```yaml
current_host: metabase.example.com

hosts:
  metabase.example.com:
    protocol: https
    token: "mb_xxxxxxxxxxxxxxxxxxxx"
    token_type: api_key          # api_key | session
    username: admin@example.com  # Optional, stored for display/reference only
    default_db: 1                # Optional, default database ID
```

**Security note:** Passwords are NEVER written to the config file. When `mb auth login` is used with username/password, only the resulting session token is stored. For auto-renewal of session tokens, credentials must be provided via `MB_USERNAME` + `MB_PASSWORD` environment variables.

### Environment Variables

| Variable | Description |
|----------|-------------|
| `MB_HOST` | Metabase server URL (e.g., `https://metabase.example.com`) |
| `MB_TOKEN` | API key |
| `MB_SESSION_TOKEN` | Session token (alternative to API key) |
| `MB_USERNAME` | Username for password-based auth |
| `MB_PASSWORD` | Password for password-based auth |
| `MB_DEFAULT_DB` | Default database ID |
| `MB_FORMAT` | Default output format (`json`, `csv`, `table`) |

### Priority

Command-line flags > Environment variables > Config file values

---

## Output Formatting

### JSON (default)

```bash
mb query "SELECT id, name FROM users LIMIT 2" --db 1
```
```json
[
  {"id": 1, "name": "Alice"},
  {"id": 2, "name": "Bob"}
]
```

With `--json` field selection:
```bash
mb db list --json id,name
```
```json
[
  {"id": 1, "name": "Production DB"},
  {"id": 2, "name": "Analytics"}
]
```

With `--jq` filtering (uses [JMESPath](https://jmespath.org/) syntax):
```bash
mb db list --jq '[].name'
```
```
["Production DB", "Analytics"]
```

### CSV

```bash
mb query "SELECT id, name FROM users LIMIT 2" --db 1 --format csv
```
```
id,name
1,Alice
2,Bob
```

### Table

```bash
mb query "SELECT id, name FROM users LIMIT 2" --db 1 --format table
```
```
┌────┬───────┐
│ id │ name  │
├────┼───────┤
│ 1  │ Alice │
│ 2  │ Bob   │
└────┴───────┘
```

### Pagination

Pagination is implemented **client-side**: the CLI sends the SQL as-is to Metabase, receives all rows from the API, then truncates based on `--limit` and `--offset`. This approach:
- Avoids modifying user SQL (no injected LIMIT/OFFSET that might conflict with user's own clauses)
- Works uniformly across all database dialects
- Trade-off: large result sets are fetched fully from Metabase before truncation

Metabase's `POST /api/dataset` applies a server-side `max-results` constraint (default 2000). The CLI does not override this; users who need more than 2000 rows should add appropriate LIMIT/OFFSET to their SQL directly.

Pagination metadata is written to stderr (does not pollute stdout):

```
// Showing rows 1-100 of 1523 returned by Metabase.
// Use --offset 100 to see next page.
```

Note: "1523" is the count of rows returned by Metabase (up to its server limit), not necessarily the total matching rows in the database.

---

## Architecture

### Project Structure

```
metabase-cli/
├── src/
│   ├── index.ts                 # Entry point, register all commands
│   ├── commands/
│   │   ├── auth/
│   │   │   ├── login.ts
│   │   │   ├── logout.ts
│   │   │   └── status.ts
│   │   ├── db/
│   │   │   ├── list.ts
│   │   │   ├── schemas.ts
│   │   │   ├── tables.ts
│   │   │   ├── fields.ts
│   │   │   └── metadata.ts
│   │   ├── query.ts
│   │   ├── card/
│   │   │   ├── list.ts
│   │   │   ├── view.ts
│   │   │   └── run.ts
│   │   ├── search.ts
│   │   └── collection/
│   │       ├── list.ts
│   │       └── view.ts
│   ├── lib/
│   │   ├── api-client.ts        # HTTP client with auth injection & retry
│   │   ├── auth.ts              # Token management & auto-renewal
│   │   ├── config.ts            # Config file read/write (YAML)
│   │   └── formatter.ts         # Output formatting (json/csv/table/jq)
│   └── types/
│       └── index.ts             # Shared type definitions
├── package.json
├── tsconfig.json
└── docs/
    └── metabase-api-doc/
        └── api-1.yaml           # Metabase OpenAPI spec (reference)
```

### Module Responsibilities

**`api-client.ts`** — Central HTTP client
- All Metabase API calls go through this module
- Auto-injects auth headers based on token type
- Handles 401 → auto-renewal → retry flow
- Unified error handling: network errors, API errors, auth errors

**`auth.ts`** — Authentication logic
- Resolves current token from CLI args → env vars → config file
- Manages session token creation via `POST /api/session`
- Token refresh/renewal logic
- Writes updated tokens back to config

**`config.ts`** — Configuration management
- Reads/writes `~/.config/mb/config.yml`
- Merges environment variables with config file values
- Provides typed access to configuration values

**`formatter.ts`** — Output formatting
- Transforms Metabase API responses into requested format
- JSON: direct output, with `--json` field selection
- CSV: via `csv-stringify`
- Table: via `cli-table3`
- `--jq`: via `jmespath` (JMESPath syntax) for JSON filtering
- Pagination metadata to stderr

### Data Flow

```
CLI Input (user/AI)
    │
    ▼
commander.js (parse args & flags)
    │
    ▼
Command Handler (src/commands/*)
    │
    ▼
api-client.ts ◄── auth.ts (resolve/refresh token)
    │                  │
    │                  ▼
    │             config.ts (read config + env vars)
    │
    ▼
HTTP Request → Metabase API Server
    │
    ▼
Response Processing
    │
    ▼
formatter.ts → stdout (json/csv/table)
               stderr (pagination info, errors)
```

---

## Metabase API Mapping

| CLI Command | HTTP Method | Metabase API Endpoint |
|-------------|-------------|----------------------|
| `mb auth login` (password) | POST | `/api/session` |
| `mb auth logout` | DELETE | `/api/session` |
| `mb db list` | GET | `/api/database` |
| `mb db schemas <id>` | GET | `/api/database/{id}/schemas` |
| `mb db tables <id>` | GET | `/api/database/{id}/metadata` (filtered to table names) |
| `mb db tables <id> --schema X` | GET | `/api/database/{id}/schema/{schema}` |
| `mb db fields <table-id>` | GET | `/api/table/{id}/query_metadata` |
| `mb db metadata <id>` | GET | `/api/database/{id}/metadata` |
| `mb query "<sql>" --db <id>` | POST | `/api/dataset` |
| `mb card list` | GET | `/api/card` |
| `mb card list --collection X` | GET | `/api/collection/{id}/items?models=card` |
| `mb card view <id>` | GET | `/api/card/{id}` |
| `mb card run <id>` | POST | `/api/card/{id}/query` |
| `mb search <query>` | GET | `/api/search` |
| `mb collection list` | GET | `/api/collection` |
| `mb collection view <id>` | GET | `/api/collection/{id}/items` |

---

## Error Handling

All errors are written to stderr with non-zero exit codes.

| Scenario | stderr Output | Exit Code |
|----------|---------------|-----------|
| Not authenticated | `Error: Not authenticated. Run 'mb auth login' first.` | 1 |
| Invalid credentials | `Error: Authentication failed. Check username/password.` | 1 |
| SQL syntax error | `Error: Query failed — <metabase error message>` | 1 |
| Card not found | `Error: Card not found (id: 42)` | 1 |
| Database not found | `Error: Database not found (id: 99)` | 1 |
| Network error | `Error: Cannot connect to <host>. Check MB_HOST or --host.` | 1 |
| Server error (5xx) | `Error: Metabase server error (HTTP 500). Try again later.` | 1 |

---

## Dependencies

```json
{
  "dependencies": {
    "commander": "^12.x",
    "yaml": "^2.x",
    "cli-table3": "^0.6.x",
    "csv-stringify": "^6.x",
    "jmespath": "^0.16.x"
  },
  "devDependencies": {
    "typescript": "^5.x",
    "tsx": "^4.x",
    "vitest": "^2.x",
    "@types/node": "^20.x"
  }
}
```

Node.js 18+ built-in `fetch` is used for HTTP requests (no external HTTP library needed).

---

## Testing Strategy

- **Unit tests**: Formatter, config parsing, auth token resolution, error handling
- **Integration tests**: Mock HTTP responses (via `vitest` mocking or `msw`), test full command execution flow
- **Framework**: vitest
- **No E2E tests**: Would require a live Metabase instance

---

## Build & Distribution

```bash
# Development
pnpm dev -- query "SELECT 1" --db 1   # Runs via tsx

# Build
pnpm build                             # tsc → dist/

# Global install
pnpm install -g .                      # Installs 'mb' globally

# npx usage
npx @example/metabase-cli query "SELECT 1" --db 1
```

`package.json`:
```json
{
  "name": "metabase-cli",
  "bin": { "mb": "./dist/index.js" },
  "scripts": {
    "dev": "tsx src/index.ts",
    "build": "tsc",
    "test": "vitest"
  }
}
```

---

## Skill Integration

When distributed as a skill for AI agents:

**Skill metadata:**
```yaml
name: metabase
description: Query data from Metabase databases. Use when the user needs to
  query business databases, run SQL, view saved reports, or explore database
  structure.
```

**Skill content structure:**
1. Prerequisites (MB_HOST + MB_TOKEN must be set)
2. Command quick reference (one line per command)
3. Recommended workflow for AI agents:
   - `mb db list` → discover databases
   - `mb db tables <id>` + `mb db fields <table-id>` → understand schema
   - `mb query "<sql>" --db <id>` → execute queries
   - `mb search "<keyword>"` → find existing reports
   - `mb card run <id>` → execute saved reports
