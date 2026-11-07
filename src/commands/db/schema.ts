import { Command } from "commander";
import { createApiClient } from "../../lib/api-client.js";
import { output } from "../../lib/formatter.js";
import { CliError } from "../../lib/cli-error.js";
import { handleCommandError, parseRequiredId, resolveOutputOptions, type DbCommandOptions } from "./common.js";

interface SchemaOptions extends DbCommandOptions {
  schema?: string;
  tables?: string;
}

interface MetadataField {
  id: number;
  name: string;
  database_type?: string;
  base_type?: string;
  semantic_type?: string | null;
  description?: string | null;
  fk_target_field_id?: number | null;
}

interface MetadataTable {
  id: number;
  name: string;
  schema?: string | null;
  description?: string | null;
  fields?: MetadataField[];
}

function selectTables(tables: MetadataTable[], opts: SchemaOptions): MetadataTable[] {
  const candidates = opts.schema === undefined
    ? tables : tables.filter((table) => table.schema === opts.schema);
  if (opts.tables === undefined) return candidates;
  const selectors = opts.tables.split(",").map((selector) => selector.trim());
  if (selectors.some((selector) => selector === "")) {
    throw new CliError("INVALID_INPUT", "--tables must contain comma-separated table names, schema-qualified names, or IDs.", "Remove empty selectors from --tables.");
  }
  const selected = new Set<number>();
  for (const selector of selectors) {
    const matches = candidates.filter((table) =>
      String(table.id) === selector || table.name === selector ||
      (table.schema != null && `${table.schema}.${table.name}` === selector),
    );
    if (matches.length === 0) throw new CliError("INVALID_INPUT", `Unknown table '${selector}'.`, "Use 'mb db tables' to list accessible tables.");
    if (matches.length > 1) throw new CliError("INVALID_INPUT", `Ambiguous table '${selector}'.`, "Use a table ID or --schema to select one table.");
    selected.add(matches[0].id);
  }
  return candidates.filter((table) => selected.has(table.id));
}

export async function handleDbSchema(dbId: number, opts: SchemaOptions) {
  const databaseId = parseRequiredId(String(dbId), "Database ID");
  if (opts.tables !== undefined && opts.tables.split(",").some((name) => !name.trim())) {
    throw new CliError("INVALID_INPUT", "--tables must contain comma-separated table names, schema-qualified names, or IDs.", "Remove empty selectors from --tables.");
  }
  const client = createApiClient(opts);
  const metadata = await client.get(`/api/database/${databaseId}/metadata`);
  if (!metadata || !Array.isArray(metadata.tables)) {
    throw new CliError("INVALID_RESPONSE", "Metabase returned invalid database metadata: expected a tables array.", "Check the instance URL and Metabase API compatibility.");
  }
  const allTables = metadata.tables as MetadataTable[];
  const targets = new Map<number, { table: MetadataTable; field: MetadataField }>();
  for (const table of allTables) {
    for (const field of table.fields ?? []) targets.set(field.id, { table, field });
  }
  return {
    database_id: databaseId,
    name: metadata.name ?? null,
    engine: metadata.engine ?? null,
    tables: selectTables(allTables, opts).map((table) => ({
      id: table.id,
      name: table.name,
      schema: table.schema ?? null,
      description: table.description ?? null,
      // Missing fields may reflect permissions; an empty list must not claim
      // that the physical table has no columns.
      fields_available: Array.isArray(table.fields),
      fields: (table.fields ?? []).map((field) => {
        const targetId = field.fk_target_field_id;
        const target = targetId == null ? undefined : targets.get(targetId);
        return {
          id: field.id,
          name: field.name,
          database_type: field.database_type ?? field.base_type ?? null,
          semantic_type: field.semantic_type ?? null,
          description: field.description ?? null,
          primary_key: field.semantic_type === "type/PK",
          foreign_key: targetId == null ? null : {
            field_id: targetId,
            ...(target ? {
              table_id: target.table.id,
              schema: target.table.schema ?? null,
              table: target.table.name,
              field: target.field.name,
            } : {}),
          },
        };
      }),
    })),
  };
}

export function registerDbSchemaCommand(parent: Command): void {
  parent.command("schema <db-id>")
    .description("Compact database schema with field types, descriptions, and declared key relationships")
    .option("--schema <name>", "Select a database schema")
    .option("--tables <names>", "Comma-separated table names, schema-qualified names, or IDs")
    .action(async function (this: Command, dbId: string) {
      const opts = this.optsWithGlobals() as SchemaOptions;
      try {
        output([await handleDbSchema(parseRequiredId(dbId, "Database ID"), opts)], resolveOutputOptions(opts));
      } catch (error) {
        handleCommandError(error, opts);
      }
    });
}
