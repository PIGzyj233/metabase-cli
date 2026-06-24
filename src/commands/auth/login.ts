import { Command } from "commander";
import { createInterface } from "node:readline";
import { storeToken, loginWithPassword, detectTokenType, type StoreTokenOptions } from "../../lib/auth.js";
import { normalizeHostKey } from "../../lib/config.js";

function resolveHostArg(host?: string): string {
  if (!host) {
    throw new Error("No host specified. Use --host.");
  }
  return host.startsWith("http") ? host : `https://${host}`;
}

export async function readTokenFromStdin(
  input: NodeJS.ReadableStream = process.stdin
): Promise<string> {
  let raw = "";
  for await (const chunk of input as AsyncIterable<Buffer | string>) {
    raw += chunk.toString();
  }
  const token = raw.trim();
  if (!token) {
    throw new Error("No token read from stdin.");
  }
  return token;
}

export async function handleLoginToken(
  host: string,
  token: string,
  options: StoreTokenOptions = {}
): Promise<void> {
  const url = new URL(host.startsWith("http") ? host : `https://${host}`);
  const tokenType = detectTokenType(token);
  const hostKey = normalizeHostKey(host);
  storeToken(hostKey, url.protocol.replace(":", ""), token, tokenType, undefined, options);
  process.stderr.write(
    `Logged in to ${hostKey} with ${tokenType === "api_key" ? "API key" : "session token"}.\n`
  );
}

export async function handleLoginPassword(
  host: string,
  username: string,
  password: string,
  options: StoreTokenOptions = {}
): Promise<void> {
  const baseUrl = host.startsWith("http") ? host : `https://${host}`;
  const url = new URL(baseUrl);
  const sessionToken = await loginWithPassword(baseUrl, username, password);
  const hostKey = normalizeHostKey(baseUrl);
  storeToken(hostKey, url.protocol.replace(":", ""), sessionToken, "session", username, options);
  process.stderr.write(`Logged in to ${hostKey} as ${username}.\n`);
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
    .option("--token-stdin", "Read API key or session token from stdin")
    .option("--username <value>", "Username for password login")
    .option("--password <value>", "Password for password login")
    .option("--as <alias>", "Profile alias to create or update")
    .option("--overwrite", "Replace an existing Profile alias")
    .action(async function (this: Command) {
      const opts = this.optsWithGlobals();
      const profileOptions = {
        alias: opts.as,
        overwrite: opts.overwrite,
      };
      try {
        if (opts.token && opts.tokenStdin) {
          throw new Error("--token and --token-stdin cannot be combined.");
        }

        // Branch 1: explicit --token
        if (opts.token) {
          const hostUrl = resolveHostArg(opts.host);
          await handleLoginToken(hostUrl, opts.token, profileOptions);
          return;
        }

        if (opts.tokenStdin) {
          const hostUrl = resolveHostArg(opts.host);
          await handleLoginToken(hostUrl, await readTokenFromStdin(), profileOptions);
          return;
        }

        // Branch 2: explicit --username + --password
        if (opts.username && opts.password) {
          const hostUrl = resolveHostArg(opts.host);
          await handleLoginPassword(hostUrl, opts.username, opts.password, profileOptions);
          return;
        }

        // Branch 3: env-var auto-login (MB_USERNAME + MB_PASSWORD)
        const envUser = process.env.MB_USERNAME;
        const envPass = process.env.MB_PASSWORD;
        if (envUser && envPass) {
          const hostUrl = resolveHostArg(opts.host);
          await handleLoginPassword(hostUrl, envUser, envPass, profileOptions);
          return;
        }

        // Branch 4: interactive login (TTY only)
        if (process.stdin.isTTY) {
          const host = opts.host || await promptLine("Metabase host: ");
          if (!host) {
            process.stderr.write("Error: Host is required.\n");
            process.exitCode = 1;
            return;
          }
          const username = await promptLine("Username: ");
          const password = await promptLine("Password: ");
          const hostUrl = host.startsWith("http") ? host : `https://${host}`;
          await handleLoginPassword(hostUrl, username, password, profileOptions);
          return;
        }

        // No credentials available
        process.stderr.write(
          "Error: Provide --token, --username + --password, set MB_USERNAME + MB_PASSWORD, or run interactively.\n"
        );
        process.exitCode = 1;
      } catch (e: any) {
        process.stderr.write(`Error: ${e.message}\n`);
        process.exitCode = 1;
      }
    });
}
