# Metabase CLI (`mb`) Auth Commands Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Tech Stack:** TypeScript 5, Node.js 18+, commander 12, vitest, pnpm

**Spec:** `docs/superpowers/specs/2026-03-22-metabase-cli-design.md`

**Goal:** Implement `mb auth login`, `mb auth logout`, and `mb auth status` on top of the shared config/auth/api-client modules.

**Architecture:** Reuse the baseline runtime to store credentials, detect token modes, and expose a small auth command surface that is safe for both interactive use and agent automation. Keep command registration isolated to the auth subtree in `src/index.ts`.

**Dependencies:** Requires Plan 01 (`2026-03-22-metabase-cli-01-foundation-core.md`).

**Covers Original Tasks:** 6

---

## Included Tasks
### Task 6: Auth Commands (login / logout / status)

**Files:**
- Create: `src/commands/auth/login.ts`
- Create: `src/commands/auth/logout.ts`
- Create: `src/commands/auth/status.ts`
- Modify: `src/index.ts` — register auth subcommands
- Create: `tests/commands/auth.test.ts`

- [x] **Step 1: Write tests for auth commands**

Create `tests/commands/auth.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { mockFetch, resetMock } from "../helpers/mock-server.js";

let testHome: string;

describe("auth commands", () => {
  beforeEach(() => {
    vi.resetModules();
    testHome = join(tmpdir(), `mb-authcmd-test-${Date.now()}`);
    mkdirSync(testHome, { recursive: true });
    vi.stubEnv("HOME", testHome);
    vi.stubEnv("USERPROFILE", testHome);
    vi.stubEnv("MB_HOST", "");
    vi.stubEnv("MB_TOKEN", "");
    vi.stubEnv("MB_SESSION_TOKEN", "");
    vi.stubEnv("MB_USERNAME", "");
    vi.stubEnv("MB_PASSWORD", "");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    resetMock();
  });

  describe("login with --token", () => {
    it("stores API key to config", async () => {
      const { handleLoginToken } = await import(
        "../../src/commands/auth/login.js"
      );
      await handleLoginToken("https://metabase.test.com", "mb_apikey123");

      const configPath = join(testHome, ".config", "mb", "config.yml");
      const content = readFileSync(configPath, "utf-8");
      expect(content).toContain("mb_apikey123");
      expect(content).toContain("api_key");
      expect(content).toContain("metabase.test.com");
    });
  });

  describe("login with username/password", () => {
    it("calls POST /api/session and stores session token", async () => {
      mockFetch([
        { status: 200, body: { id: "session_token_abc" } },
      ]);
      const { handleLoginPassword } = await import(
        "../../src/commands/auth/login.js"
      );
      await handleLoginPassword(
        "https://metabase.test.com",
        "admin@test.com",
        "password123"
      );

      const configPath = join(testHome, ".config", "mb", "config.yml");
      const content = readFileSync(configPath, "utf-8");
      expect(content).toContain("session_token_abc");
      expect(content).toContain("session");
    });
  });

  describe("logout", () => {
    it("clears stored token", async () => {
      // First store a token
      const { handleLoginToken } = await import(
        "../../src/commands/auth/login.js"
      );
      await handleLoginToken("https://metabase.test.com", "mb_apikey123");

      const { handleLogout } = await import(
        "../../src/commands/auth/logout.js"
      );
      handleLogout();

      const { loadConfig } = await import("../../src/lib/config.js");
      const config = loadConfig();
      expect(config.hosts["metabase.test.com"]).toBeUndefined();
    });
  });

  describe("status", () => {
    it("returns auth info when logged in", async () => {
      const { handleLoginToken } = await import(
        "../../src/commands/auth/login.js"
      );
      await handleLoginToken("https://metabase.test.com", "mb_apikey123");

      const { getAuthStatus } = await import(
        "../../src/commands/auth/status.js"
      );
      const status = getAuthStatus();
      expect(status.loggedIn).toBe(true);
      expect(status.host).toBe("metabase.test.com");
      expect(status.tokenType).toBe("api_key");
    });

    it("returns not logged in when no config", async () => {
      const { getAuthStatus } = await import(
        "../../src/commands/auth/status.js"
      );
      const status = getAuthStatus();
      expect(status.loggedIn).toBe(false);
    });
  });
});
```

- [x] **Step 2: Run tests to verify they fail**

Run: `pnpm test -- tests/commands/auth.test.ts`
Expected: FAIL — modules not found.

- [x] **Step 3: Implement login command**

Create `src/commands/auth/login.ts`:

```typescript
import { Command } from "commander";
import { storeToken, loginWithPassword, detectTokenType } from "../../lib/auth.js";

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

export function registerAuthLoginCommand(parent: Command): void {
  parent
    .command("login")
    .description("Login to Metabase")
    .option("--token <value>", "API key for authentication")
    .option("--username <value>", "Username for password login")
    .option("--password <value>", "Password for password login")
    .requiredOption("--host <url>", "Metabase server URL", process.env.MB_HOST)
    .action(async (opts) => {
      try {
        if (opts.token) {
          await handleLoginToken(opts.host, opts.token);
        } else if (opts.username && opts.password) {
          await handleLoginPassword(opts.host, opts.username, opts.password);
        } else {
          process.stderr.write(
            "Error: Provide --token or --username + --password.\n"
          );
          process.exit(1);
        }
      } catch (e: any) {
        process.stderr.write(`Error: ${e.message}\n`);
        process.exit(1);
      }
    });
}
```

- [x] **Step 4: Implement logout command**

Create `src/commands/auth/logout.ts`:

```typescript
import { Command } from "commander";
import { clearToken } from "../../lib/auth.js";
import { loadConfig, resolveHostUrl } from "../../lib/config.js";

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
```

- [x] **Step 5: Implement status command**

Create `src/commands/auth/status.ts`:

```typescript
import { Command } from "commander";
import { loadConfig } from "../../lib/config.js";

export interface AuthStatus {
  loggedIn: boolean;
  host?: string;
  tokenType?: string;
  username?: string;
}

export function getAuthStatus(): AuthStatus {
  const config = loadConfig();
  const host = config.current_host;
  if (!host || !config.hosts[host]?.token) {
    return { loggedIn: false };
  }
  const hostConfig = config.hosts[host];
  return {
    loggedIn: true,
    host,
    tokenType: hostConfig.token_type,
    username: hostConfig.username,
  };
}

export function registerAuthStatusCommand(parent: Command): void {
  parent
    .command("status")
    .description("Show current authentication status")
    .action(() => {
      const status = getAuthStatus();
      if (!status.loggedIn) {
        process.stdout.write("Not logged in. Run 'mb auth login' first.\n");
        return;
      }
      let msg = `Logged in to ${status.host}\n`;
      msg += `  Token type: ${status.tokenType === "api_key" ? "API Key" : "Session"}\n`;
      if (status.username) {
        msg += `  Username: ${status.username}\n`;
      }
      process.stdout.write(msg);
    });
}
```

- [x] **Step 6: Register auth commands in index.ts**

Update `src/index.ts`:

```typescript
#!/usr/bin/env node
import { Command } from "commander";
import { registerAuthLoginCommand } from "./commands/auth/login.js";
import { registerAuthLogoutCommand } from "./commands/auth/logout.js";
import { registerAuthStatusCommand } from "./commands/auth/status.js";

const program = new Command();

program
  .name("mb")
  .description("Metabase CLI — query data from the terminal")
  .version("0.1.0");

// Auth commands
const authCmd = program.command("auth").description("Manage authentication");
registerAuthLoginCommand(authCmd);
registerAuthLogoutCommand(authCmd);
registerAuthStatusCommand(authCmd);

program.parse();
```

- [x] **Step 7: Run tests to verify they pass**

Run: `pnpm test -- tests/commands/auth.test.ts`
Expected: All tests PASS.

- [x] **Step 8: Manual smoke test**

Run: `pnpm dev -- auth --help`
Expected: Shows auth subcommands: login, logout, status.

Run: `pnpm dev -- auth login --host https://example.com --token mb_test123`
Expected: stderr outputs "Logged in to example.com with API key."

Run: `pnpm dev -- auth status`
Expected: Shows "Logged in to example.com" with token type.

- [x] **Step 9: Commit**

```bash
git add src/commands/auth/ src/index.ts tests/commands/auth.test.ts
git commit -m "feat: add auth commands (login, logout, status)"
```

---

