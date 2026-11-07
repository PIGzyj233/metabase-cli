import { afterEach, describe, expect, it, vi } from "vitest";
import { spawn } from "node:child_process";
import { createProgram } from "../../src/program.js";
import { commandSchema, describeCommand, renderCommandReference } from "../../src/lib/command-schema.js";

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
function cli(args: string[], env: Record<string, string> = {}) {
  const clean = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith("MB_")));
  return new Promise<{ code: number | null; stdout: string; stderr: string }>((resolve, reject) => {
    const child = spawn(process.execPath, ["--import", "tsx", "src/index.ts", ...args], { env: { ...clean, ...env } });
    let stdout = "", stderr = "";
    child.stdout.on("data", c => { stdout += c; }); child.stderr.on("data", c => { stderr += c; });
    child.on("error", reject); child.on("close", code => resolve({ code, stdout, stderr }));
  });
}

describe("machine command schema", () => {
  it("describes the actual tree with typed inputs, defaults, globals, and effects", () => {
    const schema = commandSchema(createProgram(), ["card", "run"]);
    expect(schema.schema_version).toBe(1);
    expect(schema.command.path).toBe("mb card run");
    expect(schema.command.arguments).toContainEqual(expect.objectContaining({ name: "card-id", type: "integer", required: true }));
    expect(schema.command.options).toContainEqual(expect.objectContaining({ name: "limit", type: "integer", default: 100 }));
    expect(schema.command.options).toContainEqual(expect.objectContaining({ name: "errorFormat", inherited_from: "mb", enum: ["text", "json"] }));
    expect(schema.command.options).toContainEqual(expect.objectContaining({ name: "timeout", type: "integer", default: 30000, environment: "MB_TIMEOUT" }));
    expect(schema.command.options).toContainEqual(expect.objectContaining({ name: "format", default: "json" }));
    expect(schema.command.effect).toBe("execute");
    expect(schema.command.mutates).toBe(true);
    expect(schema.command.output_schema.$ref).toBe("#/definitions/records");
    expect(Object.keys(schema.definitions).sort()).toEqual(["error", "records"]);
  });

  it("includes Commander conflicts and newly registered options automatically", () => {
    const program = createProgram();
    program.command("extension <value>").option("--test <n>", "New option");
    const extension = commandSchema(program, ["extension"]).command;
    expect(extension.arguments[0].name).toBe("value");
    expect(extension.options).toContainEqual(expect.objectContaining({ name: "test" }));
    expect(extension.mutates).toBe(true); // unknown effects are conservative
    expect(commandSchema(program).command.options).toContainEqual(expect.objectContaining({ name: "jmespath", conflicts: ["jq"] }));
  });

  it("renders documentation from the same tree", () => {
    const program = createProgram();
    const reference = renderCommandReference(program);
    const leaves = (command: Record<string, any>): string[] => [command.path, ...command.commands.flatMap(leaves)];
    for (const path of leaves(describeCommand(program))) expect(reference).toContain(`## ${path}\n`);
    expect(reference).toContain("--error-format <type>");
    expect(reference).toContain("MB_ERROR_FORMAT");
  });

  it("works offline even with an unavailable Profile and incomplete runtime credentials", async () => {
    const result = await cli(["schema", "query"], { MB_PROFILE: "nonexistent", MB_HOST: "https://unreachable.invalid" });
    expect(result.code).toBe(0); expect(result.stderr).toBe("");
    expect(JSON.parse(result.stdout).command.path).toBe("mb query");
  });

  it("returns a structured error for an unknown command path without resolving credentials", async () => {
    const result = await cli(["schema", "not-a-command", "--error-format", "json"], { MB_PROFILE: "nonexistent" });
    expect(result.code).toBe(1); expect(result.stdout).toBe("");
    expect(JSON.parse(result.stderr)).toMatchObject({ code: "INVALID_INPUT", message: "Unknown command path: not-a-command" });
  });

  it("shows useful text help for an omitted command or subcommand", async () => {
    for (const args of [[], ["card"]]) {
      const result = await cli(args);
      expect(result.code).toBe(1); expect(result.stderr).toContain("Usage: mb");
      expect(result.stderr).not.toContain("Error: (outputHelp)");
    }
    const json = await cli(["card", "--error-format", "json"]);
    expect(JSON.parse(json.stderr)).toMatchObject({ code: "INVALID_INPUT", message: "A subcommand is required." });
  });
});
