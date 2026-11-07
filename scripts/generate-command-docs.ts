import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createProgram } from "../src/program.js";
import { renderCommandReference } from "../src/lib/command-schema.js";

const target = new URL("../docs/commands.md", import.meta.url);
const rendered = renderCommandReference(createProgram());
if (process.argv.includes("--check")) {
  let current = "";
  try { current = readFileSync(target, "utf8"); } catch { /* Missing output is stale. */ }
  if (current !== rendered) {
    process.stderr.write("Command reference is stale. Run pnpm docs:commands.\n");
    process.exitCode = 1;
  }
} else {
  mkdirSync(new URL("../docs/", import.meta.url), { recursive: true });
  writeFileSync(target, rendered, "utf8");
}
