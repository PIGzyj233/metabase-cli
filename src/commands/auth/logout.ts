import { Command } from "commander";
import { resolveInvocationProfile } from "../../lib/auth.js";
import { getInvocationTransport, HttpStatusError } from "../../lib/http-transport.js";
import { CliError } from "../../lib/cli-error.js";
import { handleCommandError } from "../../lib/errors.js";
import { outputOperationResult, type OperationResult } from "../../lib/operation-result.js";
import type { GlobalOptions } from "../../types/index.js";

export async function handleLogout(opts: GlobalOptions = {}): Promise<OperationResult> {
  const identity = resolveInvocationProfile(opts);
  if (!identity) {
    throw new CliError("AUTHENTICATION_REQUIRED", "No credentials selected for logout.", "Use a saved Profile or a complete host/token pair.");
  }
  const context = { sourceId: identity.sourceId, sourceUrl: identity.baseUrl };
  const profile = identity.kind === "profile" ? { profile: identity.sourceId } : {};
  if (identity.tokenInfo.type === "api_key") {
    process.stderr.write("API key remains active; there is no server session to revoke.\n");
    return { ...context, record: { operation: "logout", ok: true, ...profile, status: "not_applicable", revoked: false, reason: "api_key", profile_kept: identity.kind === "profile" } };
  }
  const response = await getInvocationTransport(opts).requestJson(`${identity.baseUrl}/api/session`, {
    method: "DELETE", headers: { "X-Metabase-Session": identity.tokenInfo.token },
  });
  if (!response.ok) {
    throw new HttpStatusError(response.status, `Session revocation failed (HTTP ${response.status}); the local Profile was kept.`);
  }
  process.stderr.write("Session revoked; local Profile retained.\n");
  return { ...context, record: { operation: "logout", ok: true, ...profile, status: "revoked", revoked: true, profile_kept: identity.kind === "profile" } };
}

export function registerAuthLogoutCommand(parent: Command): void {
  parent.command("logout").description("Revoke a server session while retaining its local Profile")
    .action(async function (this: Command) {
      const opts = this.optsWithGlobals() as GlobalOptions;
      try { outputOperationResult(await handleLogout(opts), opts); }
      catch (error) { handleCommandError(error, opts); }
    });
}
