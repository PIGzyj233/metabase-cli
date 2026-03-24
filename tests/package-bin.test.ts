import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("package bin entry", () => {
  it("uses a Windows-safe launcher script for all binaries", () => {
    const packageJsonPath = join(process.cwd(), "package.json");
    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"));

    expect(packageJson.bin).toEqual({
      mb: "./bin/mb.cjs",
      "metabase-cli": "./bin/mb.cjs",
    });
  });

  it("publishes the bin directory", () => {
    const packageJsonPath = join(process.cwd(), "package.json");
    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"));

    expect(packageJson.files).toContain("bin/");
  });
});
