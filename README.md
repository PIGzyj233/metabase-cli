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

Requires Node.js >= 18.

## Quick Start

```bash
# 1. Create a named Profile
mb auth login --host https://metabase.example.com --token mb_xxxx --as prod

# 2. Explore databases through the Active Profile
mb db list
mb db tables 1
mb db fields 42

# 3. Query data, or target another Profile for one command
mb query "SELECT * FROM orders LIMIT 10" --db 1
mb query "SELECT * FROM orders LIMIT 10" --db 1 --profile staging

# 4. Run saved cards
mb card list
mb card run 123 --params '{"date":"2026-01-01"}'
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

Profile management commands act on `~/.config/mb/config.yml`, not on
environment variables. Environment variables decide which identity a single
command runs as; the config file is the inventory of Profiles you can pick from.

## Commands

```
mb auth login|list|use|rm|logout|status     Authentication
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
| `--profile <alias>` | Select a Profile for one invocation |

`MB_PROFILE=<alias>` is equivalent to passing `--profile <alias>` for a single
command. `--profile`/`MB_PROFILE` cannot be combined with `--host`, `--token`,
`MB_HOST`, or `MB_TOKEN` because a Profile is an atomic identity.

## Output

- JSON by default (array of objects) — ideal for AI agent parsing
- Every JSON record includes `_source`: the Profile alias, or the Host key for
  bare override calls
- stderr includes `// Source: <alias-or-host-key> (<url>)`
- Pagination info goes to stderr: `// Showing rows 1-100 of 1523`
- Errors go to stderr with exit code 1 and are prefixed with `[source]`

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

## License

MIT
