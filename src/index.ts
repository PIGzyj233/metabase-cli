#!/usr/bin/env node
import { Command } from "commander";
import { registerAuthLoginCommand } from "./commands/auth/login.js";
import { registerAuthLogoutCommand } from "./commands/auth/logout.js";
import { registerAuthStatusCommand } from "./commands/auth/status.js";
import { registerDbFieldsCommand } from "./commands/db/fields.js";
import { registerDbListCommand } from "./commands/db/list.js";
import { registerDbMetadataCommand } from "./commands/db/metadata.js";
import { registerDbSchemasCommand } from "./commands/db/schemas.js";
import { registerDbTablesCommand } from "./commands/db/tables.js";
import { registerQueryCommand } from "./commands/query.js";
import { registerCardListCommand } from "./commands/card/list.js";
import { registerCardViewCommand } from "./commands/card/view.js";
import { registerCardRunCommand } from "./commands/card/run.js";

const program = new Command();

program
  .name("mb")
  .description("Metabase CLI — query data from the terminal")
  .version("0.1.0");

// Global flags — inherited by all subcommands
program.option("--host <url>", "Override Metabase server URL");
program.option("--token <value>", "Override authentication token");
program.option("--format <type>", "Output format: json, csv, table");
program.option("--json <fields>", "Select specific fields in JSON output");
program.option("--jq <expr>", "Filter JSON output with jmespath expression");
program.option("--no-header", "Omit header row in table/CSV output");

// Auth commands
const authCmd = program.command("auth").description("Manage authentication");
registerAuthLoginCommand(authCmd);
registerAuthLogoutCommand(authCmd);
registerAuthStatusCommand(authCmd);

// Database metadata commands
const dbCmd = program.command("db").description("Database metadata operations");
registerDbListCommand(dbCmd);
registerDbSchemasCommand(dbCmd);
registerDbTablesCommand(dbCmd);
registerDbFieldsCommand(dbCmd);
registerDbMetadataCommand(dbCmd);

// Query command
registerQueryCommand(program);

// Card commands
const cardCmd = program.command("card").description("Saved cards/questions");
registerCardListCommand(cardCmd);
registerCardViewCommand(cardCmd);
registerCardRunCommand(cardCmd);

program.parse();
