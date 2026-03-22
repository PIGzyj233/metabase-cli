#!/usr/bin/env node
import { Command } from "commander";
import { registerAuthLoginCommand } from "./commands/auth/login.js";
import { registerAuthLogoutCommand } from "./commands/auth/logout.js";
import { registerAuthStatusCommand } from "./commands/auth/status.js";

const program = new Command();

program
  .name("mb")
  .description("Metabase CLI — query data from the terminal")
  .version("0.1.0");

// Global flags — inherited by all subcommands
program.option("--host <url>", "Override Metabase server URL");
program.option("--token <value>", "Override authentication token");
program.option("--format <type>", "Output format: json, csv, table", "json");
program.option("--json <fields>", "Select specific fields in JSON output");
program.option("--jq <expr>", "Filter JSON output with jmespath expression");
program.option("--no-header", "Omit header row in table/CSV output");

// Auth commands
const authCmd = program.command("auth").description("Manage authentication");
registerAuthLoginCommand(authCmd);
registerAuthLogoutCommand(authCmd);
registerAuthStatusCommand(authCmd);

program.parse();
