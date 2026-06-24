import {
  deriveProfileAlias,
  findProfileAliasByHost,
  getActiveProfile,
  normalizeHostKey,
  loadConfig,
  saveConfig,
} from "./config.js";
import type { GlobalOptions, ProfileConfig } from "../types/index.js";

export interface TokenInfo {
  token: string;
  type: "api_key" | "session";
}

export interface ResolvedProfile {
  kind: "profile";
  sourceId: string;
  baseUrl: string;
  hostKey: string;
  tokenInfo: TokenInfo;
  username?: string;
  defaultDb?: number;
}

export interface BareOverride {
  kind: "bare";
  sourceId: string;
  baseUrl: string;
  hostKey: string;
  tokenInfo: TokenInfo;
}

export type ResolvedIdentity = ResolvedProfile | BareOverride;

export interface StoreTokenOptions {
  alias?: string;
  overwrite?: boolean;
}

export function detectTokenType(token: string): "api_key" | "session" {
  return token.startsWith("mb_") ? "api_key" : "session";
}

export function validateProfileAlias(alias: string): void {
  if (!/^[a-zA-Z0-9_-]{1,32}$/.test(alias)) {
    throw new Error(
      "Profile alias must be 1-32 characters using letters, numbers, underscores, or hyphens."
    );
  }
  if (["current", "default", "@me", "-"].includes(alias)) {
    throw new Error(`Profile alias '${alias}' is reserved.`);
  }
}

function findCaseInsensitiveAlias(
  aliases: Iterable<string>,
  requested: string
): string | undefined {
  const requestedLower = requested.toLowerCase();
  return Array.from(aliases).find((alias) => alias.toLowerCase() === requestedLower);
}

function nonEmpty(value: string | undefined): string | undefined {
  return value && value.trim() !== "" ? value : undefined;
}

function ensureBaseUrl(raw: string): string {
  return raw.startsWith("http") ? raw : `https://${raw}`;
}

function profileToIdentity(alias: string, profile: ProfileConfig): ResolvedProfile {
  return {
    kind: "profile",
    sourceId: alias,
    baseUrl: profile.instance,
    hostKey: normalizeHostKey(profile.instance),
    tokenInfo: {
      token: profile.token,
      type: profile.token_type || detectTokenType(profile.token),
    },
    username: profile.username,
    defaultDb: profile.default_db,
  };
}

export function resolveProfile(opts: GlobalOptions): ResolvedIdentity | null {
  const selectedProfile = nonEmpty(opts.profile) ?? nonEmpty(process.env.MB_PROFILE);
  const cliHost = nonEmpty(opts.host);
  const envHost = nonEmpty(process.env.MB_HOST);
  const cliToken = nonEmpty(opts.token);
  const envToken = nonEmpty(process.env.MB_TOKEN);
  const envSession = nonEmpty(process.env.MB_SESSION_TOKEN);

  if (selectedProfile) {
    const conflicts = [
      cliHost ? "--host" : undefined,
      cliToken ? "--token" : undefined,
      envHost ? "MB_HOST" : undefined,
      envToken ? "MB_TOKEN" : undefined,
      envSession ? "MB_SESSION_TOKEN" : undefined,
    ].filter(Boolean);
    if (conflicts.length > 0) {
      throw new Error(
        `Profile selection (${selectedProfile}) conflicts with ${conflicts.join(", ")}.`
      );
    }

    const config = loadConfig();
    const profile = config.profiles?.[selectedProfile];
    if (!profile) {
      const known = Object.keys(config.profiles ?? {});
      throw new Error(
        `Unknown Profile '${selectedProfile}'. Known Profiles: ${known.join(", ") || "(none)"}.`
      );
    }
    return profileToIdentity(selectedProfile, profile);
  }

  const bareHost = cliHost ?? envHost;
  const bareToken = cliToken ?? envToken ?? envSession;
  if (bareHost && bareToken) {
    const baseUrl = ensureBaseUrl(bareHost);
    const hostKey = normalizeHostKey(baseUrl);
    return {
      kind: "bare",
      sourceId: hostKey,
      baseUrl,
      hostKey,
      tokenInfo: {
        token: bareToken,
        type: bareToken === envSession ? "session" : detectTokenType(bareToken),
      },
    };
  }

  const config = loadConfig();
  const activeProfile = getActiveProfile(config);
  if (activeProfile) {
    return profileToIdentity(activeProfile.alias, activeProfile.profile);
  }

  return null;
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
  const activeProfile = getActiveProfile(config);
  if (activeProfile?.profile.token) {
    return {
      token: activeProfile.profile.token,
      type: activeProfile.profile.token_type || detectTokenType(activeProfile.profile.token),
    };
  }

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
  username?: string,
  options: StoreTokenOptions = {}
): void {
  const config = loadConfig();
  const profiles = config.profiles ?? {};
  let alias: string;
  if (options.alias) {
    validateProfileAlias(options.alias);
    const existingAlias = findCaseInsensitiveAlias(Object.keys(profiles), options.alias);
    if (existingAlias && existingAlias !== options.alias) {
      throw new Error(
        `Profile alias '${options.alias}' conflicts with existing Profile '${existingAlias}'.`
      );
    }
    if (profiles[options.alias] && !options.overwrite) {
      throw new Error(
        `Profile alias '${options.alias}' already exists. Use --overwrite to replace it.`
      );
    }
    alias = options.alias;
  } else {
    const existingAlias = findProfileAliasByHost(config, host);
    alias = existingAlias ?? deriveProfileAlias(host, Object.keys(profiles));
  }
  profiles[alias] = {
    ...profiles[alias],
    instance: `${protocol}://${host}`,
    token,
    token_type: tokenType,
  };
  if (username) {
    profiles[alias].username = username;
  }
  saveConfig({
    version: 2,
    current_profile: alias,
    profiles,
    hosts: {},
    current_host: null,
  });
}

export function clearToken(host?: string): void {
  const config = loadConfig();
  const targetAlias = host
    ? findProfileAliasByHost(config, host) ?? host
    : config.current_profile ?? undefined;
  if (targetAlias && config.profiles?.[targetAlias]) {
    delete config.profiles[targetAlias];
    if (config.current_profile === targetAlias) {
      config.current_profile = null;
    }
    saveConfig({
      version: 2,
      current_profile: config.current_profile ?? null,
      profiles: config.profiles,
      hosts: {},
      current_host: null,
    });
    return;
  }

  const targetHost = host || config.current_host;
  if (targetHost && config.hosts[targetHost]) {
    delete config.hosts[targetHost];
    if (config.current_host === targetHost) {
      config.current_host = undefined;
    }
  }
  saveConfig(config);
}
