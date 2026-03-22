import { loadConfig, saveConfig } from "./config.js";
import type { GlobalOptions } from "../types/index.js";

export interface TokenInfo {
  token: string;
  type: "api_key" | "session";
}

export function detectTokenType(token: string): "api_key" | "session" {
  return token.startsWith("mb_") ? "api_key" : "session";
}

export function resolveToken(opts: GlobalOptions): TokenInfo | null {
  // Priority 1: CLI --token
  if (opts.token) {
    return { token: opts.token, type: detectTokenType(opts.token) };
  }

  // Priority 2: MB_TOKEN env var
  const envToken = process.env.MB_TOKEN;
  if (envToken) {
    return { token: envToken, type: detectTokenType(envToken) };
  }

  // Priority 2b: MB_SESSION_TOKEN env var
  const envSession = process.env.MB_SESSION_TOKEN;
  if (envSession) {
    return { token: envSession, type: "session" };
  }

  // Priority 3: Config file
  const config = loadConfig();
  const host = config.current_host;
  if (host && config.hosts[host]?.token) {
    const hostConfig = config.hosts[host];
    return {
      token: hostConfig.token,
      type: hostConfig.token_type || detectTokenType(hostConfig.token),
    };
  }

  return null;
}

export function getAuthHeader(
  tokenInfo: TokenInfo
): Record<string, string> {
  if (tokenInfo.type === "api_key") {
    return { "X-Api-Key": tokenInfo.token };
  }
  return { "X-Metabase-Session": tokenInfo.token };
}

export async function loginWithPassword(
  baseUrl: string,
  username: string,
  password: string
): Promise<string> {
  const res = await fetch(`${baseUrl}/api/session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(
      body.message || `Authentication failed (HTTP ${res.status})`
    );
  }
  const body = await res.json();
  return body.id; // session token
}

export function storeToken(
  host: string,
  protocol: string,
  token: string,
  tokenType: "api_key" | "session",
  username?: string
): void {
  const config = loadConfig();
  config.current_host = host;
  if (!config.hosts) config.hosts = {};
  config.hosts[host] = {
    ...config.hosts[host],
    protocol,
    token,
    token_type: tokenType,
  };
  if (username) {
    config.hosts[host].username = username;
  }
  saveConfig(config);
}

export function clearToken(host?: string): void {
  const config = loadConfig();
  const targetHost = host || config.current_host;
  if (targetHost && config.hosts[targetHost]) {
    delete config.hosts[targetHost];
    if (config.current_host === targetHost) {
      config.current_host = undefined;
    }
  }
  saveConfig(config);
}
