import { Command } from "commander";
import { handleCommandError } from "../../lib/errors.js";
import { createInterface } from "node:readline";
import { storeToken, loginWithPassword, detectTokenType, type StoreTokenOptions } from "../../lib/auth.js";
import { normalizeHostKey, loadConfig } from "../../lib/config.js";
import { outputOperationResult, type OperationResult } from "../../lib/operation-result.js";
import type { GlobalOptions } from "../../types/index.js";

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
): Promise<OperationResult> {
  const url = new URL(host.startsWith("http") ? host : `https://${host}`);
  const tokenType = detectTokenType(token);
  const hostKey = normalizeHostKey(host);
  storeToken(hostKey, url.protocol.replace(":", ""), token, tokenType, undefined, options);
  process.stderr.write(
    `Logged in to ${hostKey} with ${tokenType === "api_key" ? "API key" : "session token"}.\n`
  );
  return loginReceipt(false);
}

export async function handleLoginPassword(
  host: string,
  username: string,
  password: string,
  options: StoreTokenOptions = {},
  requestOptions: GlobalOptions = {},
): Promise<OperationResult> {
  const baseUrl = host.startsWith("http") ? host : `https://${host}`;
  const url = new URL(baseUrl);
  const sessionToken = await loginWithPassword(baseUrl, username, password, requestOptions);
  const hostKey = normalizeHostKey(baseUrl);
  storeToken(hostKey, url.protocol.replace(":", ""), sessionToken, "session", username, options);
  process.stderr.write(`Logged in to ${hostKey} as ${username}.\n`);
  return loginReceipt(true);
}

function loginReceipt(verified: boolean): OperationResult {
  const config = loadConfig();
  const alias = config.current_profile;
  const profile = alias ? config.profiles?.[alias] : undefined;
  if (!alias || !profile) throw new Error("Profile disappeared after login; inspect 'mb auth list'.");
  return { sourceId: alias, sourceUrl: profile.instance,
    record: { operation: "login", ok: true, profile: alias, status: "stored", verified } };
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
          outputOperationResult(await handleLoginToken(hostUrl, opts.token, profileOptions), opts);
          return;
        }

        if (opts.tokenStdin) {
          const hostUrl = resolveHostArg(opts.host);
          outputOperationResult(await handleLoginToken(hostUrl, await readTokenFromStdin(), profileOptions), opts);
          return;
        }

        // Branch 2: explicit --username + --password
        if (opts.username && opts.password) {
          const hostUrl = resolveHostArg(opts.host);
          outputOperationResult(await handleLoginPassword(hostUrl, opts.username, opts.password, profileOptions, opts), opts);
          return;
        }

        // Branch 3: env-var auto-login (MB_USERNAME + MB_PASSWORD)
        const envUser = process.env.MB_USERNAME;
        const envPass = process.env.MB_PASSWORD;
        if (envUser && envPass) {
          const hostUrl = resolveHostArg(opts.host);
          outputOperationResult(await handleLoginPassword(hostUrl, envUser, envPass, profileOptions, opts), opts);
          return;
        }

        // Branch 4: interactive login (TTY only)
        if (process.stdin.isTTY) {
          const host = opts.host || await promptLine("Metabase host: ");
          if (!host) {
            throw new Error("Host is required.");
          }
          const username = await promptLine("Username: ");
          const password = await promptLine("Password: ");
          const hostUrl = host.startsWith("http") ? host : `https://${host}`;
          outputOperationResult(await handleLoginPassword(hostUrl, username, password, profileOptions, opts), opts);
          return;
        }

        // No credentials available
        throw new Error("Credentials required. Provide --token, --username + --password, set MB_USERNAME + MB_PASSWORD, or run interactively.");
      } catch (e: any) {
        handleCommandError(e, opts, { resolveSource: false, sourceId: opts.as });
      }
    });
}
