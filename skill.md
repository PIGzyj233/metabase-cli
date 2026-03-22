---
name: metabase
description: Query data from Metabase databases. Use when the user needs to query business databases, run SQL, view saved reports, or explore database structure via Metabase. Make sure to use this skill whenever the user mentions Metabase, business data queries, saved questions/cards, database schema exploration, or wants to run SQL against a BI platform, even if they don't explicitly say "metabase".
---

# Metabase CLI (`mb`)

Query Metabase databases from the terminal. Designed for AI agent use — JSON output by default, pagination info to stderr, structured errors.

## Installation

### Global Install (Recommended)

```bash
npm install -g metabase-cli
```

After installation, the `mb` command is available globally:

```bash
mb --version
mb --help
```

### One-off Execution via npx

No installation needed — run directly:

```bash
npx metabase-cli --help
npx metabase-cli db list
npx metabase-cli query "SELECT 1" --db 1
```

### Uninstall

```bash
npm uninstall -g metabase-cli
```

To also remove the config file:

```bash
# Linux/macOS
rm -rf ~/.config/mb

# Windows
rmdir /s /q %USERPROFILE%\.config\mb
```

## Prerequisites

Configure authentication before use (pick one):

**Option A — Environment variables:**
- `MB_HOST` — Metabase server URL (e.g., `https://metabase.example.com`)
- `MB_TOKEN` — API key (starts with `mb_`), OR
- `MB_USERNAME` + `MB_PASSWORD` — session-based auth with auto-renewal

**Option B — Interactive login:**
```bash
mb auth login --host https://metabase.example.com --token mb_xxxx
# or
mb auth login --host https://metabase.example.com --username user@co.com --password secret
```

Credentials are saved to `~/.config/mb/config.yml`.

## Commands

### Authentication
| Command | Description |
|---------|-------------|
| `mb auth login --host <url> --token <key>` | Login with API key |
| `mb auth login --host <url> --username <u> --password <p>` | Login with password |
| `mb auth status` | Show current auth state |
| `mb auth logout` | Clear credentials |

### Database Exploration
| Command | Description |
|---------|-------------|
| `mb db list` | List all databases |
| `mb db schemas <db-id>` | List schemas in a database |
| `mb db tables <db-id> [--schema <name>]` | List tables |
| `mb db fields <table-id>` | List table fields (name, type, description) |
| `mb db metadata <db-id>` | Full database metadata |

### Query Execution
| Command | Description |
|---------|-------------|
| `mb query "<sql>" --db <id>` | Execute native SQL |
| `mb card list [--collection <id>]` | List saved cards |
| `mb card view <card-id>` | View card definition and parameters |
| `mb card run <card-id> [--params '{"key":"val"}']` | Run saved card |

### Search & Browse
| Command | Description |
|---------|-------------|
| `mb search <query> [--type card\|dashboard\|collection\|table]` | Search Metabase |
| `mb collection list [--parent <id>]` | List collections |
| `mb collection view <id>` | View collection contents |

### Global Flags
All commands support: `--format json|csv|table` (default: json), `--json <fields>`, `--jq <jmespath-expr>`, `--no-header`.

`query` and `card run` also support: `--limit <n>` (default: 100), `--offset <n>` for pagination.

## Recommended Workflow

1. `mb db list` — discover available databases
2. `mb db tables <db-id>` — see tables in a database
3. `mb db fields <table-id>` — understand table schema
4. `mb query "SELECT ..." --db <id>` — run your query
5. If query returned many rows, use `--offset` to paginate

Or find existing reports:
1. `mb search "<keyword>"` — find saved cards/dashboards
2. `mb card view <id>` — check parameters needed
3. `mb card run <id> --params '{"key":"value"}'` — execute

## Output

- Default output is JSON (array of objects), ideal for AI parsing
- Pagination info goes to stderr, e.g.: `// Showing rows 1-100 of 1523`
- Errors go to stderr with exit code 1
