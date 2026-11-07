import { createRequire } from "node:module";
import { registerHttpOptions } from "./lib/http-transport.js";
import { registerSchemaCommand } from "./lib/command-schema.js";
import { CliError } from "./lib/cli-error.js";
import { handleCommandError } from "./lib/errors.js";
import type { GlobalOptions } from "./types/index.js";
import { Command, Option } from "commander";
import { parseJmesPathExpression } from "./lib/input-validation.js";
import { registerAuthLoginCommand } from "./commands/auth/login.js";
import { registerAuthListCommand } from "./commands/auth/list.js";
import { registerAuthLogoutCommand } from "./commands/auth/logout.js";
import { registerAuthRmCommand } from "./commands/auth/rm.js";
import { registerAuthStatusCommand } from "./commands/auth/status.js";
import { registerAuthUseCommand } from "./commands/auth/use.js";
import { registerAuthCheckCommand } from "./commands/auth/check.js";
import { registerAuthSetDefaultDbCommand } from "./commands/auth/set-default-db.js";
import { registerDbFieldsCommand } from "./commands/db/fields.js";
import { registerDbListCommand } from "./commands/db/list.js";
import { registerDbMetadataCommand } from "./commands/db/metadata.js";
import { registerDbSchemasCommand } from "./commands/db/schemas.js";
import { registerDbTablesCommand } from "./commands/db/tables.js";
import { registerDbSchemaCommand } from "./commands/db/schema.js";
import { registerQueryCommand } from "./commands/query.js";
import { registerCardListCommand } from "./commands/card/list.js";
import { registerCardCreateCommand } from "./commands/card/create.js";
import { registerCardUpdateCommand } from "./commands/card/update.js";
import { registerCardDeleteCommand } from "./commands/card/delete.js";
import { registerCardArchiveCommand } from "./commands/card/archive.js";
import { registerCardViewCommand } from "./commands/card/view.js";
import { registerCardRunCommand } from "./commands/card/run.js";
import { registerSearchCommand } from "./commands/search.js";
import { registerCollectionListCommand } from "./commands/collection/list.js";
import { registerCollectionViewCommand } from "./commands/collection/view.js";

export function createProgram(): Command {
  const program = new Command();

  program
    .name("mb")
    .description("Metabase CLI — query data from the terminal")
    .version(createRequire(import.meta.url)("../package.json").version);

  // Global flags — inherited by all subcommands
  program.option("--host <url>", "Override Metabase server URL");
  program.option("--token <value>", "Override authentication token");
  program.option("--profile <alias>", "Select a named Profile for this invocation");
  program.addOption(new Option("--format <type>", "Output format: json, csv, table")
    .choices(["json", "csv", "table"]).env("MB_FORMAT").default("json"));
  program.addOption(new Option("--error-format <type>", "Error output format: text or json")
    .choices(["text", "json"]).env("MB_ERROR_FORMAT").default("text"));
  program.option("--json <fields>", "Select specific fields in JSON output");
  program.addOption(new Option("--jmespath <expr>", "Filter JSON output with a JMESPath expression")
    .argParser(parseJmesPathExpression).conflicts("jq"));
  program.option("--jq <expr>", "Legacy alias for --jmespath (uses JMESPath syntax)", parseJmesPathExpression);
  program.hook("preAction", () => {
    const expression = program.opts().jmespath;
    if (expression !== undefined) program.setOptionValue("jq", expression);
  });
  program.option("--no-header", "Omit header row in table/CSV output");

  registerHttpOptions(program);

  // Auth commands
  const authCmd = program.command("auth").description("Manage authentication");
  registerAuthLoginCommand(authCmd);
  registerAuthListCommand(authCmd);
  registerAuthLogoutCommand(authCmd);
  registerAuthRmCommand(authCmd);
  registerAuthStatusCommand(authCmd);
  registerAuthUseCommand(authCmd);
  registerAuthCheckCommand(authCmd);
  registerAuthSetDefaultDbCommand(authCmd);

  // Database metadata commands
  const dbCmd = program.command("db").description("Database metadata operations");
  registerDbListCommand(dbCmd);
  registerDbSchemasCommand(dbCmd);
  registerDbTablesCommand(dbCmd);
  registerDbFieldsCommand(dbCmd);
  registerDbMetadataCommand(dbCmd);
  registerDbSchemaCommand(dbCmd);

  // Query command
  registerQueryCommand(program);

  // Card commands
  const cardCmd = program.command("card").description("Saved cards/questions");
  registerCardListCommand(cardCmd);
  registerCardCreateCommand(cardCmd);
  registerCardUpdateCommand(cardCmd);
  registerCardDeleteCommand(cardCmd);
  registerCardArchiveCommand(cardCmd);
  registerCardViewCommand(cardCmd);
  registerCardRunCommand(cardCmd);

  // Search command
  registerSearchCommand(program);

  // Collection commands
  const collectionCmd = program.command("collection").description("Browse collections");
  registerCollectionListCommand(collectionCmd);
  registerCollectionViewCommand(collectionCmd);

  registerSchemaCommand(program);
  return program;
}


function errorOptionsFromArgv(argv: string[]): GlobalOptions & { password?: string } {
  const opts: GlobalOptions & { password?: string } = {};
  const fields = { "--error-format": "errorFormat", "--token": "token", "--password": "password" } as const;
  for (let i = 0; i < argv.length && argv[i] !== "--"; i++) {
    for (const [flag, field] of Object.entries(fields)) {
      const value = argv[i] === flag ? argv[i + 1] : argv[i].startsWith(`${flag}=`) ? argv[i].slice(flag.length + 1) : undefined;
      if (value !== undefined) Object.assign(opts, { [field]: value });
    }
  }
  return opts;
}

export async function runCli(argv: string[] = process.argv): Promise<void> {
  const program = createProgram();
  let actionOptions: GlobalOptions | undefined;
  let commanderHelp = "";
  const configure = (command: Command) => {
    command.exitOverride();
    command.configureOutput({ writeErr: text => { commanderHelp += text; }, outputError: () => {} });
    command.commands.forEach(configure);
  };
  configure(program);
  program.hook("preAction", (_command, action) => { actionOptions = action.optsWithGlobals(); });
  try {
    await program.parseAsync(argv);
  } catch (error) {
    if (error && typeof error === "object" && "exitCode" in error && error.exitCode === 0) return;
    const opts = actionOptions ?? { ...program.opts(), ...errorOptionsFromArgv(argv.slice(2)) };
    if (commanderHelp) {
      if ((opts.errorFormat ?? process.env.MB_ERROR_FORMAT) !== "json") {
        process.stderr.write(commanderHelp);
        process.exitCode = 1;
        return;
      }
      error = new CliError("INVALID_INPUT", "A subcommand is required.", "Run 'mb schema' or --help to inspect available commands.");
    }
    handleCommandError(error, opts, { resolveSource: actionOptions !== undefined });
  }
}
