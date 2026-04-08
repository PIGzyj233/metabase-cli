---
name: metabase
description: Query data from Metabase databases. Use when the user needs to query business databases, run SQL, view saved reports, or explore database structure via Metabase. Make sure to use this skill whenever the user mentions Metabase, business data queries, saved questions/cards, database schema exploration, or wants to run SQL against a BI platform, even if they don't explicitly say "metabase".
---

# Metabase CLI (`mb`)

Query Metabase databases from the terminal. Designed for AI agent use — JSON output by default, pagination info to stderr, structured errors.

## Installation

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
| `mb card create --name <name> --database <id> --sql "<sql>"` | Create a native SQL card |
| `mb card create --from <file>` | Create a card from a JSON payload file |
| `mb card view <card-id>` | View card definition, parameters, and template tags |
| `mb card run <card-id> [--params '{"key":"val"}']` | Run saved card (uses `card.parameters`) |
| `mb card run <card-id> [--template-tags '{"key":"val"}']` | Run native SQL card (uses template tags) |
| `mb card update <card-id> [--name ...] [--description ...] [--collection <id>] [--sql "<sql>"]` | Safely update a card via fetch-then-merge |
| `mb card update <card-id> --from <file>` | Apply a JSON patch file to an existing card |
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
- Pagination info goes to stderr, e.g.: `// Showing rows 1-100 of 1523`
- Errors go to stderr with exit code 1
