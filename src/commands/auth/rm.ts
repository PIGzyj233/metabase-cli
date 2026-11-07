import { CliError } from "../../lib/cli-error.js";
import { Command } from "commander";
import { handleCommandError } from "../../lib/errors.js";
import { getInvocationTransport } from "../../lib/http-transport.js";
import { outputOperationResult, type OperationResult } from "../../lib/operation-result.js";
import type { GlobalOptions } from "../../types/index.js";
import { loadConfig, saveConfig } from "../../lib/config.js";

export async function handleAuthRm(alias: string, opts: GlobalOptions = {}): Promise<OperationResult> {
  const config = loadConfig();
  const profile = config.profiles?.[alias];
  if (!profile) {
    const known = Object.keys(config.profiles ?? {});
    throw new Error(
      `Unknown Profile '${alias}'. Known Profiles: ${known.join(", ") || "(none)"}.`
    );
  }

  let revokeStatus: "revoked" | "failed" | "not_applicable" = "not_applicable";
  if (profile.token_type === "session") {
    try {
      const response = await getInvocationTransport(opts).requestJson(`${profile.instance}/api/session`, {
        method: "DELETE",
        headers: { "X-Metabase-Session": profile.token },
      });
      revokeStatus = response.ok ? "revoked" : "failed";
    } catch {
      revokeStatus = "failed";
      // Best effort: local removal still wins.
    }
  }

  // Revocation may await the network. Preserve changes made by another agent
  // during that wait, and never remove a replacement identity under this alias.
  const latest = loadConfig();
  const current = latest.profiles?.[alias];
  if (current && (current.instance !== profile.instance || current.token !== profile.token || current.token_type !== profile.token_type)) {
    throw new CliError("CONFIGURATION_ERROR", `Profile '${alias}' changed during removal; its replacement was kept.`,
      "Inspect 'mb auth list' and retry removal only if the current Profile is the intended target.");
  }
  const profiles = { ...(latest.profiles ?? {}) };
  delete profiles[alias];
  saveConfig({
    ...latest,
    version: 2,
    current_profile: latest.current_profile === alias
      ? null
      : latest.current_profile ?? null,
    profiles,
    hosts: {},
    current_host: null,
  });
  process.stderr.write(`Removed Profile ${alias}.\n`);
  return { sourceId: alias, sourceUrl: profile.instance, record: { operation: "rm", ok: true, profile: alias,
    status: "removed", session_revoked: revokeStatus === "revoked", revoke_status: revokeStatus } };
}

export function registerAuthRmCommand(parent: Command): void {
  parent
    .command("rm <alias>")
    .description("Remove a saved Profile")
    .action(async function (this: Command, alias: string) {
      try {
        const opts = this.optsWithGlobals();
        outputOperationResult(await handleAuthRm(alias, opts), opts);
      } catch (error: any) {
        handleCommandError(error, this.optsWithGlobals(), { resolveSource: false, sourceId: alias });
      }
    });
}
