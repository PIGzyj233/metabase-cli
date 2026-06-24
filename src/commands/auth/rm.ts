import { Command } from "commander";
import { loadConfig, saveConfig } from "../../lib/config.js";

export async function handleAuthRm(alias: string): Promise<void> {
  const config = loadConfig();
  const profile = config.profiles?.[alias];
  if (!profile) {
    const known = Object.keys(config.profiles ?? {});
    throw new Error(
      `Unknown Profile '${alias}'. Known Profiles: ${known.join(", ") || "(none)"}.`
    );
  }

  if (profile.token_type === "session") {
    try {
      await fetch(`${profile.instance}/api/session`, {
        method: "DELETE",
        headers: { "X-Metabase-Session": profile.token },
      });
    } catch {
      // Best effort: local removal still wins.
    }
  }

  const profiles = { ...(config.profiles ?? {}) };
  delete profiles[alias];
  saveConfig({
    version: 2,
    current_profile: config.current_profile === alias
      ? null
      : config.current_profile ?? null,
    profiles,
    hosts: {},
    current_host: null,
  });
  process.stderr.write(`Removed Profile ${alias}.\n`);
}

export function registerAuthRmCommand(parent: Command): void {
  parent
    .command("rm <alias>")
    .description("Remove a saved Profile")
    .action(async (alias: string) => {
      try {
        await handleAuthRm(alias);
      } catch (error: any) {
        process.stderr.write(`Error: ${error.message}\n`);
        process.exitCode = 1;
      }
    });
}
