import { Command, Option } from "commander";
import { CliError } from "./cli-error.js";
import { handleCommandError } from "./errors.js";

type Effect = "inspect" | "read" | "execute" | "write" | "local-write" | "authenticate";
interface Contract { effect: Effect; output: string; examples: string[]; constraints?: string[] }

export const COMMAND_CONTRACTS: Record<string, Contract> = {
  "auth login": { effect: "authenticate", output: "receipt", examples: ["mb auth login --host https://metabase.example.com --token-stdin --as prod"], constraints: ["Provide one credential source: token, token-stdin, or username plus password."] },
  "auth list": { effect: "inspect", output: "profiles", examples: ["mb auth list"] },
  "auth status": { effect: "inspect", output: "authStatus", examples: ["mb auth status --profile prod"] },
  "auth check": { effect: "read", output: "authCheck", examples: ["mb auth check --profile prod"] },
  "auth use": { effect: "local-write", output: "receipt", examples: ["mb auth use prod"] },
  "auth rm": { effect: "write", output: "receipt", examples: ["mb auth rm staging"] },
  "auth logout": { effect: "write", output: "receipt", examples: ["mb auth logout --profile prod"] },
  "auth set-default-db": { effect: "local-write", output: "defaultDatabase", examples: ["mb auth set-default-db 1 --profile prod"] },
  "db list": { effect: "read", output: "databases", examples: ["mb db list --profile prod"] },
  "db schemas": { effect: "read", output: "schemas", examples: ["mb db schemas 1"] },
  "db tables": { effect: "read", output: "tables", examples: ["mb db tables 1 --schema public"] },
  "db fields": { effect: "read", output: "fields", examples: ["mb db fields 42"] },
  "db metadata": { effect: "read", output: "records", examples: ["mb db metadata 1"] },
  "db schema": { effect: "read", output: "databaseSchema", examples: ["mb db schema 1 --tables orders,customers"] },
  "query": { effect: "execute", output: "records", examples: ["mb query 'SELECT 1' --db 1"], constraints: ["Provide exactly one SQL source: positional sql or --file (use - for stdin).", "--limit and --offset slice the returned response locally; each invocation submits the query again."] },
  "card list": { effect: "read", output: "cards", examples: ["mb card list --collection 5"] },
  "card view": { effect: "read", output: "cardDetail", examples: ["mb card view 42"] },
  "card run": { effect: "execute", output: "records", examples: ["mb card run 42 --params '{\"date\":\"2026-01-01\"}'"], constraints: ["Use at most one parameter source: --params, --params-file, --template-tags, or --template-tags-file.", "--limit and --offset slice the returned response locally; each invocation submits the query again."] },
  "card create": { effect: "write", output: "records", examples: ["mb card create --name Example --database 1 --sql 'SELECT 1'"], constraints: ["Use --from alone or supply --name, one database option and one SQL source."] },
  "card update": { effect: "write", output: "records", examples: ["mb card update 42 --name 'Updated report'"], constraints: ["Use --from alone or at least one inline patch flag. Inline SQL updates require a native-query card."] },
  "card delete": { effect: "write", output: "receipt", examples: ["mb card delete 42"], constraints: ["Archives by default. --hard-delete permanently deletes the card."] },
  "card archive": { effect: "write", output: "receipt", examples: ["mb card archive 42"] },
  "search": { effect: "read", output: "searchResults", examples: ["mb search revenue --type card"] },
  "collection list": { effect: "read", output: "collections", examples: ["mb collection list"] },
  "collection view": { effect: "read", output: "collectionItems", examples: ["mb collection view 5"] },
  "schema": { effect: "inspect", output: "commandSchema", examples: ["mb schema", "mb schema card run"] },
};

const string = { type: "string" };
const nullableString = { type: ["string", "null"] };
const integer = { type: "integer" };
const bool = { type: "boolean" };
function records(properties: Record<string, unknown> = {}, required: string[] = []) {
  return { type: "array", items: { type: "object", properties: { _source: { type: "string", minLength: 1 }, ...properties }, required, additionalProperties: true } };
}
export const OUTPUT_DEFINITIONS: Record<string, unknown> = {
  records: records({}, ["_source"]),
  receipt: records({ operation: string, ok: bool, id: integer, profile: string, status: string, revoked: bool }, ["_source", "operation", "ok"]),
  profiles: records({ alias: string, instance: string, tokenType: string, active: bool }, ["_source", "alias", "instance", "tokenType", "active"]),
  authStatus: records({ loggedIn: bool, host: string, tokenType: string }, ["loggedIn"]),
  authCheck: records({ reachable: bool, authenticated: bool, database_count: integer, elapsed_ms: { type: "number" } }, ["_source", "reachable", "authenticated"]),
  defaultDatabase: records({ operation: string, ok: bool, status: string, profile: string, default_db: integer }, ["_source", "operation", "ok", "profile", "default_db"]),
  databases: records({ id: integer, name: string, engine: string }, ["_source", "id", "name"]),
  schemas: records({ schema: string }, ["_source", "schema"]),
  tables: records({ id: integer, name: string, schema: { type: ["string", "null"] } }, ["_source", "id", "name"]),
  fields: records({ id: integer, name: string, database_type: string, description: { type: ["string", "null"] } }, ["_source", "id", "name"]),
  databaseSchema: records({
    database_id: integer, name: nullableString, engine: nullableString,
    tables: { type: "array", items: { type: "object", properties: {
      id: integer, name: nullableString, schema: nullableString, description: nullableString,
      fields_available: bool, fields: { type: "array", items: { type: "object", properties: {
        id: integer, name: nullableString, database_type: nullableString,
        semantic_type: nullableString, description: nullableString, primary_key: bool,
        foreign_key: { anyOf: [{ type: "null" }, { type: "object", properties: {
          field_id: integer, table_id: integer, schema: nullableString, table: nullableString, field: nullableString,
        }, required: ["field_id"], additionalProperties: false }] },
      }, additionalProperties: true } },
    }, additionalProperties: true } },
  }, ["_source", "database_id", "tables"]),
  cards: records({ id: integer, name: string, collection_id: { type: ["integer", "null"] } }, ["_source", "id", "name"]),
  cardDetail: records({ id: integer, name: string, query_type: string, query: { type: ["string", "object"] }, parameters: { type: "array" }, template_tags: { type: "array" } }, ["_source", "id", "name"]),
  collections: records({ id: { type: ["integer", "string"] }, name: string, location: string }, ["_source", "id", "name"]),
  collectionItems: records({ id: integer, name: string, model: string }, ["_source", "id", "name"]),
  searchResults: records({ id: integer, name: string, model: string }, ["_source", "id", "name"]),
  commandSchema: { type: "object", required: ["schema_version", "cli_version", "command", "definitions"] },
  error: { type: "object", properties: { code: string, message: string, http_status: { type: "integer", minimum: 100, maximum: 599 }, retryable: bool, hint: string, source: string }, required: ["code", "message", "retryable", "hint"], additionalProperties: false },
};

function commandPath(command: Command): string[] {
  return command.parent ? [...commandPath(command.parent), command.name()] : [command.name()];
}
function valueType(name: string, boolean = false): string | string[] {
  if (boolean) return "boolean";
  if (/^(db|database|limit|offset|timeout|deadline|retries|parent|db-id|table-id|card-id)$/.test(name)) return "integer";
  if (/^(collection|collection-id)$/.test(name)) return ["integer", "string"];
  return "string";
}
function describeOption(option: Option, inheritedFrom?: string) {
  const internal = option as Option & { conflictsWith?: string[] };
  return {
    flags: option.flags, name: option.attributeName(), description: option.description,
    type: valueType(option.attributeName(), !option.required && !option.optional),
    required: option.mandatory, value_required: option.required, variadic: option.variadic,
    ...(option.defaultValue !== undefined ? { default: option.defaultValue } : option.negate ? { default: true } : {}),
    ...(option.argChoices ? { enum: option.argChoices } : {}),
    ...(option.envVar ? { environment: option.envVar } : {}),
    conflicts: internal.conflictsWith ?? [],
    ...(inheritedFrom ? { inherited_from: inheritedFrom } : {}),
  };
}

export function describeCommand(command: Command): Record<string, any> {
  const path = commandPath(command);
  const key = path.slice(1).join(" ");
  const contract = COMMAND_CONTRACTS[key];
  const own = command.createHelp().visibleOptions(command);
  const inherited = [];
  const seen = new Set(own.map(option => option.attributeName()));
  for (let parent = command.parent; parent; parent = parent.parent) {
    for (const option of parent.options) {
      if (!seen.has(option.attributeName())) {
        inherited.push(describeOption(option, commandPath(parent).join(" ")));
        seen.add(option.attributeName());
      }
    }
  }
  return {
    path: path.join(" "), description: command.description(), aliases: command.aliases(),
    arguments: command.registeredArguments.map(argument => ({
      name: argument.name(), description: argument.description,
      type: argument.variadic ? "array" : valueType(argument.name()),
      ...(argument.variadic ? { items: { type: valueType(argument.name()) } } : {}),
      required: argument.required, variadic: argument.variadic,
      ...(argument.defaultValue !== undefined ? { default: argument.defaultValue } : {}),
      ...(argument.argChoices ? { enum: argument.argChoices } : {}),
    })),
    options: [...own.map(option => describeOption(option)), ...inherited],
    effect: contract?.effect ?? (command.commands.length ? "inspect" : "unknown"),
    mutates: contract ? !["inspect", "read"].includes(contract.effect) : command.commands.length === 0,
    constraints: contract?.constraints ?? [], examples: contract?.examples ?? [],
    ...(contract ? { output_schema: { $ref: `#/definitions/${contract.output}` }, error_schema: { $ref: "#/definitions/error" } } : {}),
    commands: command.commands.map(describeCommand),
  };
}

export function commandSchema(program: Command, path: string[] = []) {
  let selected = program;
  for (const part of path) {
    const next = selected.commands.find(command => command.name() === part || command.aliases().includes(part));
    if (!next) throw new CliError("INVALID_INPUT", `Unknown command path: ${path.join(" ")}`, "Run 'mb schema' to list available commands.");
    selected = next;
  }
  const command = describeCommand(selected);
  const referenced = new Set<string>(["error"]);
  const collect = (node: Record<string, any>) => {
    if (node.output_schema) referenced.add(node.output_schema.$ref.split("/").at(-1));
    node.commands.forEach(collect);
  };
  collect(command);
  return {
    schema_version: 1, cli_version: program.version(),
    notes: ["Output schemas describe default JSON before field selection or explicit JMESPath transformation.", "Errors use the error schema only with --error-format json or MB_ERROR_FORMAT=json; diagnostics may precede the final error record on stderr.", "execute commands may modify data depending on SQL and database permissions; they are not assumed read-only."],
    command, definitions: Object.fromEntries([...referenced].map(name => [name, OUTPUT_DEFINITIONS[name]])),
  };
}

export function registerSchemaCommand(program: Command): void {
  program.command("schema [command...]")
    .description("Describe commands, inputs, effects, and output schemas as JSON (offline)")
    .action(function (this: Command, path: string[]) {
      try { process.stdout.write(JSON.stringify(commandSchema(program, path), null, 2) + "\n"); }
      catch (error) { handleCommandError(error, this.optsWithGlobals(), { resolveSource: false }); }
    });
}

export function renderCommandReference(program: Command): string {
  const tree = describeCommand(program);
  const lines = ["# Command reference", "", "Generated from the CLI command definitions. Run `pnpm docs:commands` to regenerate.", "", "Use `mb schema [command...]` for machine-readable arguments, effects, and output schemas.", ""];
  function visit(command: Record<string, any>) {
    lines.push(`## ${command.path}`, "", command.description, "");
    if (command.arguments.length) {
      lines.push("| Argument | Type | Required |", "| --- | --- | --- |");
      for (const arg of command.arguments) lines.push(`| ${arg.name} | ${[].concat(arg.type).join(" or ")} | ${arg.required} |`);
      lines.push("");
    }
    lines.push("| Option | Description | Default / environment |", "| --- | --- | --- |");
    for (const option of command.options) {
      const escape = (value: unknown) => String(value ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ");
      lines.push(`| ${escape(option.flags)} | ${escape(option.description)}${option.inherited_from ? " (global)" : ""} | ${escape([option.default !== undefined ? JSON.stringify(option.default) : "", option.environment ?? ""].filter(Boolean).join(" / "))} |`);
    }
    lines.push("", `Effect: **${command.effect}**. May modify state: **${command.mutates}**.`, "");
    for (const constraint of command.constraints) lines.push(`- ${constraint}`);
    if (command.constraints.length) lines.push("");
    if (command.examples.length) lines.push("```bash", ...command.examples, "```", "");
    command.commands.forEach(visit);
  }
  visit(tree);
  return lines.join("\n");
}
