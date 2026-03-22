import { Command } from "commander";
import { createInterface } from "node:readline";
import { storeToken, loginWithPassword, detectTokenType } from "../../lib/auth.js";

function resolveHostArg(host?: string): string {
  const resolved = host || process.env.MB_HOST;
  if (!resolved) {
    throw new Error("No host specified. Use --host or set MB_HOST.");
  }
  return resolved.startsWith("http") ? resolved : `https://${resolved}`;
}

export async function handleLoginToken(host: string, token: string): Promise<void> {
  const url = new URL(host.startsWith("http") ? host : `https://${host}`);
  const tokenType = detectTokenType(token);
  storeToken(url.hostname, url.protocol.replace(":", ""), token, tokenType);
  process.stderr.write(
    `Logged in to ${url.hostname} with ${tokenType === "api_key" ? "API key" : "session token"}.\n`
  );
}

export async function handleLoginPassword(
  host: string,
  username: string,
  password: string
): Promise<void> {
  const baseUrl = host.startsWith("http") ? host : `https://${host}`;
  const url = new URL(baseUrl);
  const sessionToken = await loginWithPassword(baseUrl, username, password);
  storeToken(url.hostname, url.protocol.replace(":", ""), sessionToken, "session", username);
  process.stderr.write(`Logged in to ${url.hostname} as ${username}.\n`);
}

async function promptLine(prompt: string, hidden = false): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stderr });
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

export function registerAuthLoginCommand(parent: Command): void {
  parent
    .command("login")
    .description("Login to Metabase")
    .option("--token <value>", "API key for authentication")
    .option("--username <value>", "Username for password login")
    .option("--password <value>", "Password for password login")
    .option("--host <url>", "Metabase server URL", process.env.MB_HOST)
    .action(async (opts) => {
      try {
        // Branch 1: explicit --token
        if (opts.token) {
          const hostUrl = resolveHostArg(opts.host);
          await handleLoginToken(hostUrl, opts.token);
          return;
        }

        // Branch 2: explicit --username + --password
        if (opts.username && opts.password) {
          const hostUrl = resolveHostArg(opts.host);
          await handleLoginPassword(hostUrl, opts.username, opts.password);
          return;
        }

        // Branch 3: env-var auto-login (MB_USERNAME + MB_PASSWORD)
        const envUser = process.env.MB_USERNAME;
        const envPass = process.env.MB_PASSWORD;
        if (envUser && envPass) {
          const hostUrl = resolveHostArg(opts.host);
          await handleLoginPassword(hostUrl, envUser, envPass);
          return;
        }

        // Branch 4: interactive login (TTY only)
        if (process.stdin.isTTY) {
          const host = opts.host || await promptLine("Metabase host: ");
          if (!host) {
            process.stderr.write("Error: Host is required.\n");
            process.exit(1);
          }
          const username = await promptLine("Username: ");
          const password = await promptLine("Password: ");
          const hostUrl = host.startsWith("http") ? host : `https://${host}`;
          await handleLoginPassword(hostUrl, username, password);
          return;
        }

        // No credentials available
        process.stderr.write(
          "Error: Provide --token, --username + --password, set MB_USERNAME + MB_PASSWORD, or run interactively.\n"
        );
        process.exit(1);
      } catch (e: any) {
        process.stderr.write(`Error: ${e.message}\n`);
        process.exit(1);
      }
    });
}
