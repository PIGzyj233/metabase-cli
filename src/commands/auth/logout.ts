import { Command } from "commander";
import { resolveProfile } from "../../lib/auth.js";
import type { GlobalOptions } from "../../types/index.js";

export async function handleLogout(opts: GlobalOptions = {}): Promise<void> {
  const identity = resolveProfile(opts);
  if (identity?.tokenInfo.type === "session") {
    try {
      await fetch(`${identity.baseUrl}/api/session`, {
        method: "DELETE",
        headers: { "X-Metabase-Session": identity.tokenInfo.token },
      });
    } catch {
      // Best effort — proceed with local cleanup even if server call fails
    }
    process.stderr.write("Logged out.\n");
    return;
  }
  process.stderr.write("Logged out.\n");
}

export function registerAuthLogoutCommand(parent: Command): void {
  parent
    .command("logout")
    .description("Logout from Metabase")
    .action(async function (this: Command) {
      await handleLogout(this.optsWithGlobals() as GlobalOptions);
    });
}
