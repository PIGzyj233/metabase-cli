# metabase-cli

> Query Metabase databases from the terminal. Designed for AI agents.

[![npm](https://img.shields.io/npm/v/metabase-cli)](https://www.npmjs.com/package/metabase-cli)
[![license](https://img.shields.io/npm/l/metabase-cli)](https://github.com/PIGzyj233/metabase-cli/blob/main/LICENSE)

## Install

```bash
# Global install
npm install -g metabase-cli

# Or run without installing
npx metabase-cli <command>
```

Requires Node.js >= 18.

## Quick Start

```bash
# 1. Authenticate
mb auth login --host https://metabase.example.com --token mb_xxxx

# 2. Explore databases
mb db list
mb db tables 1
mb db fields 42

# 3. Query data
mb query "SELECT * FROM orders LIMIT 10" --db 1

# 4. Run saved cards
mb card list
mb card run 123 --params '{"date":"2026-01-01"}'
```

## Authentication

Pick one:

| Method | Setup |
|--------|-------|
| API key | `mb auth login --host <url> --token mb_xxxx` |
| Password | `mb auth login --host <url> --username user@co.com --password secret` |
| Env vars | Set `MB_HOST` + `MB_TOKEN` (or `MB_USERNAME` + `MB_PASSWORD`) |

Credentials are saved to `~/.config/mb/config.yml`.

## Commands

```
mb auth login|logout|status     Authentication
mb db list|schemas|tables|fields|metadata   Database exploration
mb query "<sql>" --db <id>      Execute SQL
mb card list|view|run           Saved cards/questions
mb search <query>               Full-text search
mb collection list|view         Browse collections
```

### Global Flags

| Flag | Description |
|------|-------------|
| `--format json\|csv\|table` | Output format (default: json) |
| `--json <fields>` | Select specific JSON fields |
| `--jq <expr>` | JMESPath filter expression |
| `--no-header` | Omit header in table/CSV output |
| `--host <url>` | Override Metabase URL |
| `--token <value>` | Override auth token |

## Output

- JSON by default (array of objects) — ideal for AI agent parsing
- Pagination info goes to stderr: `// Showing rows 1-100 of 1523`
- Errors go to stderr with exit code 1

## Uninstall

```bash
npm uninstall -g metabase-cli

# Optional: remove config
rm -rf ~/.config/mb
```

## AI Agent Integration

This CLI is designed as a tool for AI agents (Claude, GPT, etc.). See [`skill.md`](./skill.md) for the agent skill definition.

## License

MIT
