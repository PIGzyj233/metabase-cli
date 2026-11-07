# Command reference

Generated from the CLI command definitions. Run `pnpm docs:commands` to regenerate.

Use `mb schema [command...]` for machine-readable arguments, effects, and output schemas.

## mb

Metabase CLI — query data from the terminal

| Option | Description | Default / environment |
| --- | --- | --- |
| -V, --version | output the version number |  |
| --host <url> | Override Metabase server URL |  |
| --token <value> | Override authentication token |  |
| --profile <alias> | Select a named Profile for this invocation |  |
| --format <type> | Output format: json, csv, table | MB_FORMAT |
| --error-format <type> | Error output format: text or json | MB_ERROR_FORMAT |
| --json <fields> | Select specific fields in JSON output |  |
| --jmespath <expr> | Filter JSON output with a JMESPath expression |  |
| --jq <expr> | Legacy alias for --jmespath (uses JMESPath syntax) |  |
| --no-header | Omit header row in table/CSV output | true |
| -h, --help | display help for command |  |

Effect: **inspect**. May modify state: **false**.

## mb auth

Manage authentication

| Option | Description | Default / environment |
| --- | --- | --- |
| -h, --help | display help for command |  |
| -V, --version | output the version number (global) |  |
| --host <url> | Override Metabase server URL (global) |  |
| --token <value> | Override authentication token (global) |  |
| --profile <alias> | Select a named Profile for this invocation (global) |  |
| --format <type> | Output format: json, csv, table (global) | MB_FORMAT |
| --error-format <type> | Error output format: text or json (global) | MB_ERROR_FORMAT |
| --json <fields> | Select specific fields in JSON output (global) |  |
| --jmespath <expr> | Filter JSON output with a JMESPath expression (global) |  |
| --jq <expr> | Legacy alias for --jmespath (uses JMESPath syntax) (global) |  |
| --no-header | Omit header row in table/CSV output (global) | true |

Effect: **inspect**. May modify state: **false**.

## mb auth login

Login to Metabase

| Option | Description | Default / environment |
| --- | --- | --- |
| --token <value> | API key for authentication |  |
| --token-stdin | Read API key or session token from stdin |  |
| --username <value> | Username for password login |  |
| --password <value> | Password for password login |  |
| --as <alias> | Profile alias to create or update |  |
| --overwrite | Replace an existing Profile alias |  |
| -h, --help | display help for command |  |
| -V, --version | output the version number (global) |  |
| --host <url> | Override Metabase server URL (global) |  |
| --profile <alias> | Select a named Profile for this invocation (global) |  |
| --format <type> | Output format: json, csv, table (global) | MB_FORMAT |
| --error-format <type> | Error output format: text or json (global) | MB_ERROR_FORMAT |
| --json <fields> | Select specific fields in JSON output (global) |  |
| --jmespath <expr> | Filter JSON output with a JMESPath expression (global) |  |
| --jq <expr> | Legacy alias for --jmespath (uses JMESPath syntax) (global) |  |
| --no-header | Omit header row in table/CSV output (global) | true |

Effect: **authenticate**. May modify state: **true**.

- Provide one credential source: token, token-stdin, or username plus password.

```bash
mb auth login --host https://metabase.example.com --token-stdin --as prod
```

## mb auth list

List saved Profiles

| Option | Description | Default / environment |
| --- | --- | --- |
| -h, --help | display help for command |  |
| -V, --version | output the version number (global) |  |
| --host <url> | Override Metabase server URL (global) |  |
| --token <value> | Override authentication token (global) |  |
| --profile <alias> | Select a named Profile for this invocation (global) |  |
| --format <type> | Output format: json, csv, table (global) | MB_FORMAT |
| --error-format <type> | Error output format: text or json (global) | MB_ERROR_FORMAT |
| --json <fields> | Select specific fields in JSON output (global) |  |
| --jmespath <expr> | Filter JSON output with a JMESPath expression (global) |  |
| --jq <expr> | Legacy alias for --jmespath (uses JMESPath syntax) (global) |  |
| --no-header | Omit header row in table/CSV output (global) | true |

Effect: **inspect**. May modify state: **false**.

```bash
mb auth list
```

## mb auth logout

Logout from Metabase

| Option | Description | Default / environment |
| --- | --- | --- |
| -h, --help | display help for command |  |
| -V, --version | output the version number (global) |  |
| --host <url> | Override Metabase server URL (global) |  |
| --token <value> | Override authentication token (global) |  |
| --profile <alias> | Select a named Profile for this invocation (global) |  |
| --format <type> | Output format: json, csv, table (global) | MB_FORMAT |
| --error-format <type> | Error output format: text or json (global) | MB_ERROR_FORMAT |
| --json <fields> | Select specific fields in JSON output (global) |  |
| --jmespath <expr> | Filter JSON output with a JMESPath expression (global) |  |
| --jq <expr> | Legacy alias for --jmespath (uses JMESPath syntax) (global) |  |
| --no-header | Omit header row in table/CSV output (global) | true |

Effect: **write**. May modify state: **true**.

```bash
mb auth logout --profile prod
```

## mb auth rm

Remove a saved Profile

| Argument | Type | Required |
| --- | --- | --- |
| alias | string | true |

| Option | Description | Default / environment |
| --- | --- | --- |
| -h, --help | display help for command |  |
| -V, --version | output the version number (global) |  |
| --host <url> | Override Metabase server URL (global) |  |
| --token <value> | Override authentication token (global) |  |
| --profile <alias> | Select a named Profile for this invocation (global) |  |
| --format <type> | Output format: json, csv, table (global) | MB_FORMAT |
| --error-format <type> | Error output format: text or json (global) | MB_ERROR_FORMAT |
| --json <fields> | Select specific fields in JSON output (global) |  |
| --jmespath <expr> | Filter JSON output with a JMESPath expression (global) |  |
| --jq <expr> | Legacy alias for --jmespath (uses JMESPath syntax) (global) |  |
| --no-header | Omit header row in table/CSV output (global) | true |

Effect: **write**. May modify state: **true**.

```bash
mb auth rm staging
```

## mb auth status

Show current authentication status

| Option | Description | Default / environment |
| --- | --- | --- |
| -h, --help | display help for command |  |
| -V, --version | output the version number (global) |  |
| --host <url> | Override Metabase server URL (global) |  |
| --token <value> | Override authentication token (global) |  |
| --profile <alias> | Select a named Profile for this invocation (global) |  |
| --format <type> | Output format: json, csv, table (global) | MB_FORMAT |
| --error-format <type> | Error output format: text or json (global) | MB_ERROR_FORMAT |
| --json <fields> | Select specific fields in JSON output (global) |  |
| --jmespath <expr> | Filter JSON output with a JMESPath expression (global) |  |
| --jq <expr> | Legacy alias for --jmespath (uses JMESPath syntax) (global) |  |
| --no-header | Omit header row in table/CSV output (global) | true |

Effect: **inspect**. May modify state: **false**.

```bash
mb auth status --profile prod
```

## mb auth use

Set the Active Profile

| Argument | Type | Required |
| --- | --- | --- |
| alias | string | true |

| Option | Description | Default / environment |
| --- | --- | --- |
| -h, --help | display help for command |  |
| -V, --version | output the version number (global) |  |
| --host <url> | Override Metabase server URL (global) |  |
| --token <value> | Override authentication token (global) |  |
| --profile <alias> | Select a named Profile for this invocation (global) |  |
| --format <type> | Output format: json, csv, table (global) | MB_FORMAT |
| --error-format <type> | Error output format: text or json (global) | MB_ERROR_FORMAT |
| --json <fields> | Select specific fields in JSON output (global) |  |
| --jmespath <expr> | Filter JSON output with a JMESPath expression (global) |  |
| --jq <expr> | Legacy alias for --jmespath (uses JMESPath syntax) (global) |  |
| --no-header | Omit header row in table/CSV output (global) | true |

Effect: **local-write**. May modify state: **true**.

```bash
mb auth use prod
```

## mb db

Database metadata operations

| Option | Description | Default / environment |
| --- | --- | --- |
| -h, --help | display help for command |  |
| -V, --version | output the version number (global) |  |
| --host <url> | Override Metabase server URL (global) |  |
| --token <value> | Override authentication token (global) |  |
| --profile <alias> | Select a named Profile for this invocation (global) |  |
| --format <type> | Output format: json, csv, table (global) | MB_FORMAT |
| --error-format <type> | Error output format: text or json (global) | MB_ERROR_FORMAT |
| --json <fields> | Select specific fields in JSON output (global) |  |
| --jmespath <expr> | Filter JSON output with a JMESPath expression (global) |  |
| --jq <expr> | Legacy alias for --jmespath (uses JMESPath syntax) (global) |  |
| --no-header | Omit header row in table/CSV output (global) | true |

Effect: **inspect**. May modify state: **false**.

## mb db list

List all databases

| Option | Description | Default / environment |
| --- | --- | --- |
| -h, --help | display help for command |  |
| -V, --version | output the version number (global) |  |
| --host <url> | Override Metabase server URL (global) |  |
| --token <value> | Override authentication token (global) |  |
| --profile <alias> | Select a named Profile for this invocation (global) |  |
| --format <type> | Output format: json, csv, table (global) | MB_FORMAT |
| --error-format <type> | Error output format: text or json (global) | MB_ERROR_FORMAT |
| --json <fields> | Select specific fields in JSON output (global) |  |
| --jmespath <expr> | Filter JSON output with a JMESPath expression (global) |  |
| --jq <expr> | Legacy alias for --jmespath (uses JMESPath syntax) (global) |  |
| --no-header | Omit header row in table/CSV output (global) | true |

Effect: **read**. May modify state: **false**.

```bash
mb db list --profile prod
```

## mb db schemas

List schemas in a database

| Argument | Type | Required |
| --- | --- | --- |
| db-id | integer | true |

| Option | Description | Default / environment |
| --- | --- | --- |
| -h, --help | display help for command |  |
| -V, --version | output the version number (global) |  |
| --host <url> | Override Metabase server URL (global) |  |
| --token <value> | Override authentication token (global) |  |
| --profile <alias> | Select a named Profile for this invocation (global) |  |
| --format <type> | Output format: json, csv, table (global) | MB_FORMAT |
| --error-format <type> | Error output format: text or json (global) | MB_ERROR_FORMAT |
| --json <fields> | Select specific fields in JSON output (global) |  |
| --jmespath <expr> | Filter JSON output with a JMESPath expression (global) |  |
| --jq <expr> | Legacy alias for --jmespath (uses JMESPath syntax) (global) |  |
| --no-header | Omit header row in table/CSV output (global) | true |

Effect: **read**. May modify state: **false**.

```bash
mb db schemas 1
```

## mb db tables

List tables in a database

| Argument | Type | Required |
| --- | --- | --- |
| db-id | integer | true |

| Option | Description | Default / environment |
| --- | --- | --- |
| --schema <name> | Filter by schema name |  |
| -h, --help | display help for command |  |
| -V, --version | output the version number (global) |  |
| --host <url> | Override Metabase server URL (global) |  |
| --token <value> | Override authentication token (global) |  |
| --profile <alias> | Select a named Profile for this invocation (global) |  |
| --format <type> | Output format: json, csv, table (global) | MB_FORMAT |
| --error-format <type> | Error output format: text or json (global) | MB_ERROR_FORMAT |
| --json <fields> | Select specific fields in JSON output (global) |  |
| --jmespath <expr> | Filter JSON output with a JMESPath expression (global) |  |
| --jq <expr> | Legacy alias for --jmespath (uses JMESPath syntax) (global) |  |
| --no-header | Omit header row in table/CSV output (global) | true |

Effect: **read**. May modify state: **false**.

```bash
mb db tables 1 --schema public
```

## mb db fields

List fields of a table

| Argument | Type | Required |
| --- | --- | --- |
| table-id | integer | true |

| Option | Description | Default / environment |
| --- | --- | --- |
| -h, --help | display help for command |  |
| -V, --version | output the version number (global) |  |
| --host <url> | Override Metabase server URL (global) |  |
| --token <value> | Override authentication token (global) |  |
| --profile <alias> | Select a named Profile for this invocation (global) |  |
| --format <type> | Output format: json, csv, table (global) | MB_FORMAT |
| --error-format <type> | Error output format: text or json (global) | MB_ERROR_FORMAT |
| --json <fields> | Select specific fields in JSON output (global) |  |
| --jmespath <expr> | Filter JSON output with a JMESPath expression (global) |  |
| --jq <expr> | Legacy alias for --jmespath (uses JMESPath syntax) (global) |  |
| --no-header | Omit header row in table/CSV output (global) | true |

Effect: **read**. May modify state: **false**.

```bash
mb db fields 42
```

## mb db metadata

Full database metadata dump

| Argument | Type | Required |
| --- | --- | --- |
| db-id | integer | true |

| Option | Description | Default / environment |
| --- | --- | --- |
| -h, --help | display help for command |  |
| -V, --version | output the version number (global) |  |
| --host <url> | Override Metabase server URL (global) |  |
| --token <value> | Override authentication token (global) |  |
| --profile <alias> | Select a named Profile for this invocation (global) |  |
| --format <type> | Output format: json, csv, table (global) | MB_FORMAT |
| --error-format <type> | Error output format: text or json (global) | MB_ERROR_FORMAT |
| --json <fields> | Select specific fields in JSON output (global) |  |
| --jmespath <expr> | Filter JSON output with a JMESPath expression (global) |  |
| --jq <expr> | Legacy alias for --jmespath (uses JMESPath syntax) (global) |  |
| --no-header | Omit header row in table/CSV output (global) | true |

Effect: **read**. May modify state: **false**.

```bash
mb db metadata 1
```

## mb query

Execute a native SQL query

| Argument | Type | Required |
| --- | --- | --- |
| sql | string | true |

| Option | Description | Default / environment |
| --- | --- | --- |
| --db <id> | Database ID (or set MB_DEFAULT_DB) |  |
| --limit <n> | Max rows to display from the response (local slice) | 100 |
| --offset <n> | Rows to skip locally; each invocation submits the query again | 0 |
| -h, --help | display help for command |  |
| -V, --version | output the version number (global) |  |
| --host <url> | Override Metabase server URL (global) |  |
| --token <value> | Override authentication token (global) |  |
| --profile <alias> | Select a named Profile for this invocation (global) |  |
| --format <type> | Output format: json, csv, table (global) | MB_FORMAT |
| --error-format <type> | Error output format: text or json (global) | MB_ERROR_FORMAT |
| --json <fields> | Select specific fields in JSON output (global) |  |
| --jmespath <expr> | Filter JSON output with a JMESPath expression (global) |  |
| --jq <expr> | Legacy alias for --jmespath (uses JMESPath syntax) (global) |  |
| --no-header | Omit header row in table/CSV output (global) | true |

Effect: **execute**. May modify state: **true**.

- Provide exactly one SQL source: positional sql or --file (use - for stdin).
- --limit and --offset slice the returned response locally; each invocation submits the query again.

```bash
mb query 'SELECT 1' --db 1
```

## mb card

Saved cards/questions

| Option | Description | Default / environment |
| --- | --- | --- |
| -h, --help | display help for command |  |
| -V, --version | output the version number (global) |  |
| --host <url> | Override Metabase server URL (global) |  |
| --token <value> | Override authentication token (global) |  |
| --profile <alias> | Select a named Profile for this invocation (global) |  |
| --format <type> | Output format: json, csv, table (global) | MB_FORMAT |
| --error-format <type> | Error output format: text or json (global) | MB_ERROR_FORMAT |
| --json <fields> | Select specific fields in JSON output (global) |  |
| --jmespath <expr> | Filter JSON output with a JMESPath expression (global) |  |
| --jq <expr> | Legacy alias for --jmespath (uses JMESPath syntax) (global) |  |
| --no-header | Omit header row in table/CSV output (global) | true |

Effect: **inspect**. May modify state: **false**.

## mb card list

List saved cards/questions

| Option | Description | Default / environment |
| --- | --- | --- |
| --collection <id> | Filter by collection |  |
| -h, --help | display help for command |  |
| -V, --version | output the version number (global) |  |
| --host <url> | Override Metabase server URL (global) |  |
| --token <value> | Override authentication token (global) |  |
| --profile <alias> | Select a named Profile for this invocation (global) |  |
| --format <type> | Output format: json, csv, table (global) | MB_FORMAT |
| --error-format <type> | Error output format: text or json (global) | MB_ERROR_FORMAT |
| --json <fields> | Select specific fields in JSON output (global) |  |
| --jmespath <expr> | Filter JSON output with a JMESPath expression (global) |  |
| --jq <expr> | Legacy alias for --jmespath (uses JMESPath syntax) (global) |  |
| --no-header | Omit header row in table/CSV output (global) | true |

Effect: **read**. May modify state: **false**.

```bash
mb card list --collection 5
```

## mb card create

Create a saved card/question

| Option | Description | Default / environment |
| --- | --- | --- |
| --name <name> | Card name |  |
| --database <id> | Database ID for inline native SQL mode |  |
| --sql <sql> | Native SQL query text for inline mode |  |
| --display <type> | Card display type |  |
| --collection <id> | Collection ID or NanoID |  |
| --description <text> | Card description |  |
| --type <type> | Card type |  |
| --from <file> | Read full create payload from JSON file |  |
| -h, --help | display help for command |  |
| -V, --version | output the version number (global) |  |
| --host <url> | Override Metabase server URL (global) |  |
| --token <value> | Override authentication token (global) |  |
| --profile <alias> | Select a named Profile for this invocation (global) |  |
| --format <type> | Output format: json, csv, table (global) | MB_FORMAT |
| --error-format <type> | Error output format: text or json (global) | MB_ERROR_FORMAT |
| --json <fields> | Select specific fields in JSON output (global) |  |
| --jmespath <expr> | Filter JSON output with a JMESPath expression (global) |  |
| --jq <expr> | Legacy alias for --jmespath (uses JMESPath syntax) (global) |  |
| --no-header | Omit header row in table/CSV output (global) | true |

Effect: **write**. May modify state: **true**.

- Use --from alone or supply --name, one database option and one SQL source.

```bash
mb card create --name Example --database 1 --sql 'SELECT 1'
```

## mb card update

Update a saved card/question

| Argument | Type | Required |
| --- | --- | --- |
| card-id | integer | true |

| Option | Description | Default / environment |
| --- | --- | --- |
| --name <name> | Card name |  |
| --description <text> | Card description |  |
| --collection <id> | Collection ID or NanoID |  |
| --archived | Archive the card |  |
| --sql <sql> | Native SQL query text for native-query cards |  |
| --from <file> | Read update patch from JSON file |  |
| -h, --help | display help for command |  |
| -V, --version | output the version number (global) |  |
| --host <url> | Override Metabase server URL (global) |  |
| --token <value> | Override authentication token (global) |  |
| --profile <alias> | Select a named Profile for this invocation (global) |  |
| --format <type> | Output format: json, csv, table (global) | MB_FORMAT |
| --error-format <type> | Error output format: text or json (global) | MB_ERROR_FORMAT |
| --json <fields> | Select specific fields in JSON output (global) |  |
| --jmespath <expr> | Filter JSON output with a JMESPath expression (global) |  |
| --jq <expr> | Legacy alias for --jmespath (uses JMESPath syntax) (global) |  |
| --no-header | Omit header row in table/CSV output (global) | true |

Effect: **write**. May modify state: **true**.

- Use --from alone or at least one inline patch flag. Inline SQL updates require a native-query card.

```bash
mb card update 42 --name 'Updated report'
```

## mb card delete

Delete a saved card/question

| Argument | Type | Required |
| --- | --- | --- |
| card-id | integer | true |

| Option | Description | Default / environment |
| --- | --- | --- |
| --hard-delete | Permanently delete instead of archiving |  |
| -h, --help | display help for command |  |
| -V, --version | output the version number (global) |  |
| --host <url> | Override Metabase server URL (global) |  |
| --token <value> | Override authentication token (global) |  |
| --profile <alias> | Select a named Profile for this invocation (global) |  |
| --format <type> | Output format: json, csv, table (global) | MB_FORMAT |
| --error-format <type> | Error output format: text or json (global) | MB_ERROR_FORMAT |
| --json <fields> | Select specific fields in JSON output (global) |  |
| --jmespath <expr> | Filter JSON output with a JMESPath expression (global) |  |
| --jq <expr> | Legacy alias for --jmespath (uses JMESPath syntax) (global) |  |
| --no-header | Omit header row in table/CSV output (global) | true |

Effect: **write**. May modify state: **true**.

- Archives by default. --hard-delete permanently deletes the card.

```bash
mb card delete 42
```

## mb card archive

Archive a saved card/question

| Argument | Type | Required |
| --- | --- | --- |
| card-id | integer | true |

| Option | Description | Default / environment |
| --- | --- | --- |
| -h, --help | display help for command |  |
| -V, --version | output the version number (global) |  |
| --host <url> | Override Metabase server URL (global) |  |
| --token <value> | Override authentication token (global) |  |
| --profile <alias> | Select a named Profile for this invocation (global) |  |
| --format <type> | Output format: json, csv, table (global) | MB_FORMAT |
| --error-format <type> | Error output format: text or json (global) | MB_ERROR_FORMAT |
| --json <fields> | Select specific fields in JSON output (global) |  |
| --jmespath <expr> | Filter JSON output with a JMESPath expression (global) |  |
| --jq <expr> | Legacy alias for --jmespath (uses JMESPath syntax) (global) |  |
| --no-header | Omit header row in table/CSV output (global) | true |

Effect: **write**. May modify state: **true**.

```bash
mb card archive 42
```

## mb card view

View card definition, query, and parameters

| Argument | Type | Required |
| --- | --- | --- |
| card-id | integer | true |

| Option | Description | Default / environment |
| --- | --- | --- |
| -h, --help | display help for command |  |
| -V, --version | output the version number (global) |  |
| --host <url> | Override Metabase server URL (global) |  |
| --token <value> | Override authentication token (global) |  |
| --profile <alias> | Select a named Profile for this invocation (global) |  |
| --format <type> | Output format: json, csv, table (global) | MB_FORMAT |
| --error-format <type> | Error output format: text or json (global) | MB_ERROR_FORMAT |
| --json <fields> | Select specific fields in JSON output (global) |  |
| --jmespath <expr> | Filter JSON output with a JMESPath expression (global) |  |
| --jq <expr> | Legacy alias for --jmespath (uses JMESPath syntax) (global) |  |
| --no-header | Omit header row in table/CSV output (global) | true |

Effect: **read**. May modify state: **false**.

```bash
mb card view 42
```

## mb card run

Execute a saved card/question

| Argument | Type | Required |
| --- | --- | --- |
| card-id | integer | true |

| Option | Description | Default / environment |
| --- | --- | --- |
| --params <json> | Parameters as JSON key-value pairs |  |
| --template-tags <json> | Template tag parameters as JSON key-value pairs (for native queries) |  |
| --limit <n> | Max rows to display from the response (local slice) | 100 |
| --offset <n> | Rows to skip locally; each invocation submits the query again | 0 |
| -h, --help | display help for command |  |
| -V, --version | output the version number (global) |  |
| --host <url> | Override Metabase server URL (global) |  |
| --token <value> | Override authentication token (global) |  |
| --profile <alias> | Select a named Profile for this invocation (global) |  |
| --format <type> | Output format: json, csv, table (global) | MB_FORMAT |
| --error-format <type> | Error output format: text or json (global) | MB_ERROR_FORMAT |
| --json <fields> | Select specific fields in JSON output (global) |  |
| --jmespath <expr> | Filter JSON output with a JMESPath expression (global) |  |
| --jq <expr> | Legacy alias for --jmespath (uses JMESPath syntax) (global) |  |
| --no-header | Omit header row in table/CSV output (global) | true |

Effect: **execute**. May modify state: **true**.

- Use at most one parameter source: --params, --params-file, --template-tags, or --template-tags-file.
- --limit and --offset slice the returned response locally; each invocation submits the query again.

```bash
mb card run 42 --params '{"date":"2026-01-01"}'
```

## mb search

Search cards, dashboards, collections, and tables

| Argument | Type | Required |
| --- | --- | --- |
| query | string | true |

| Option | Description | Default / environment |
| --- | --- | --- |
| --type <type> | Filter: card, dashboard, collection, table |  |
| -h, --help | display help for command |  |
| -V, --version | output the version number (global) |  |
| --host <url> | Override Metabase server URL (global) |  |
| --token <value> | Override authentication token (global) |  |
| --profile <alias> | Select a named Profile for this invocation (global) |  |
| --format <type> | Output format: json, csv, table (global) | MB_FORMAT |
| --error-format <type> | Error output format: text or json (global) | MB_ERROR_FORMAT |
| --json <fields> | Select specific fields in JSON output (global) |  |
| --jmespath <expr> | Filter JSON output with a JMESPath expression (global) |  |
| --jq <expr> | Legacy alias for --jmespath (uses JMESPath syntax) (global) |  |
| --no-header | Omit header row in table/CSV output (global) | true |

Effect: **read**. May modify state: **false**.

```bash
mb search revenue --type card
```

## mb collection

Browse collections

| Option | Description | Default / environment |
| --- | --- | --- |
| -h, --help | display help for command |  |
| -V, --version | output the version number (global) |  |
| --host <url> | Override Metabase server URL (global) |  |
| --token <value> | Override authentication token (global) |  |
| --profile <alias> | Select a named Profile for this invocation (global) |  |
| --format <type> | Output format: json, csv, table (global) | MB_FORMAT |
| --error-format <type> | Error output format: text or json (global) | MB_ERROR_FORMAT |
| --json <fields> | Select specific fields in JSON output (global) |  |
| --jmespath <expr> | Filter JSON output with a JMESPath expression (global) |  |
| --jq <expr> | Legacy alias for --jmespath (uses JMESPath syntax) (global) |  |
| --no-header | Omit header row in table/CSV output (global) | true |

Effect: **inspect**. May modify state: **false**.

## mb collection list

List collections

| Option | Description | Default / environment |
| --- | --- | --- |
| --parent <id> | Filter by parent collection |  |
| -h, --help | display help for command |  |
| -V, --version | output the version number (global) |  |
| --host <url> | Override Metabase server URL (global) |  |
| --token <value> | Override authentication token (global) |  |
| --profile <alias> | Select a named Profile for this invocation (global) |  |
| --format <type> | Output format: json, csv, table (global) | MB_FORMAT |
| --error-format <type> | Error output format: text or json (global) | MB_ERROR_FORMAT |
| --json <fields> | Select specific fields in JSON output (global) |  |
| --jmespath <expr> | Filter JSON output with a JMESPath expression (global) |  |
| --jq <expr> | Legacy alias for --jmespath (uses JMESPath syntax) (global) |  |
| --no-header | Omit header row in table/CSV output (global) | true |

Effect: **read**. May modify state: **false**.

```bash
mb collection list
```

## mb collection view

View collection contents

| Argument | Type | Required |
| --- | --- | --- |
| collection-id | integer or string | true |

| Option | Description | Default / environment |
| --- | --- | --- |
| -h, --help | display help for command |  |
| -V, --version | output the version number (global) |  |
| --host <url> | Override Metabase server URL (global) |  |
| --token <value> | Override authentication token (global) |  |
| --profile <alias> | Select a named Profile for this invocation (global) |  |
| --format <type> | Output format: json, csv, table (global) | MB_FORMAT |
| --error-format <type> | Error output format: text or json (global) | MB_ERROR_FORMAT |
| --json <fields> | Select specific fields in JSON output (global) |  |
| --jmespath <expr> | Filter JSON output with a JMESPath expression (global) |  |
| --jq <expr> | Legacy alias for --jmespath (uses JMESPath syntax) (global) |  |
| --no-header | Omit header row in table/CSV output (global) | true |

Effect: **read**. May modify state: **false**.

```bash
mb collection view 5
```

## mb schema

Describe commands, inputs, effects, and output schemas as JSON (offline)

| Argument | Type | Required |
| --- | --- | --- |
| command | array | false |

| Option | Description | Default / environment |
| --- | --- | --- |
| -h, --help | display help for command |  |
| -V, --version | output the version number (global) |  |
| --host <url> | Override Metabase server URL (global) |  |
| --token <value> | Override authentication token (global) |  |
| --profile <alias> | Select a named Profile for this invocation (global) |  |
| --format <type> | Output format: json, csv, table (global) | MB_FORMAT |
| --error-format <type> | Error output format: text or json (global) | MB_ERROR_FORMAT |
| --json <fields> | Select specific fields in JSON output (global) |  |
| --jmespath <expr> | Filter JSON output with a JMESPath expression (global) |  |
| --jq <expr> | Legacy alias for --jmespath (uses JMESPath syntax) (global) |  |
| --no-header | Omit header row in table/CSV output (global) | true |

Effect: **inspect**. May modify state: **false**.

```bash
mb schema
mb schema card run
```
