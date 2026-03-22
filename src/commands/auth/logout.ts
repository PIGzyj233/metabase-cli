import { Command } from "commander";
import { clearToken } from "../../lib/auth.js";
import { loadConfig } from "../../lib/config.js";

export async function handleLogout(host?: string): Promise<void> {
  // If session token, invalidate on server
  const config = loadConfig();
  const targetHost = host || config.current_host;
  if (targetHost && config.hosts[targetHost]?.token_type === "session") {
    try {
      const protocol = config.hosts[targetHost].protocol || "https";
      const baseUrl = `${protocol}://${targetHost}`;
      await fetch(`${baseUrl}/api/session`, {
        method: "DELETE",
        headers: { "X-Metabase-Session": config.hosts[targetHost].token },
      });
    } catch {
      // Best effort — proceed with local cleanup even if server call fails
    }
  }
  clearToken(host);
  process.stderr.write("Logged out.\n");
}

export function registerAuthLogoutCommand(parent: Command): void {
  parent
    .command("logout")
    .description("Logout from Metabase")
    .action(async () => {
      await handleLogout();
    });
}
