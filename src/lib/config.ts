import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { homedir } from "node:os";
import { parse, stringify } from "yaml";
import type { Config, GlobalOptions, HostConfig, ProfileConfig } from "../types/index.js";

export function getConfigDir(): string {
  return join(homedir(), ".config", "mb");
}

export function getConfigPath(): string {
  return join(getConfigDir(), "config.yml");
}

export function loadConfig(): Config {
  const configPath = getConfigPath();
  if (!existsSync(configPath)) {
    return { hosts: {}, profiles: {} };
  }
  const content = readFileSync(configPath, "utf-8");
  const parsed = parse(content);
  if (parsed?.version === 2) {
    return normalizeConfig(parsed);
  }
  if (parsed?.hosts || parsed?.current_host) {
    return migrateLegacyConfig(parsed, configPath);
  }
  return {
    current_host: parsed?.current_host,
    hosts: parsed?.hosts ?? {},
  };
}

export function saveConfig(config: Config): void {
  const configPath = getConfigPath();
  const dir = dirname(configPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(configPath, stringify(config), "utf-8");
}

function normalizeConfig(parsed: any): Config {
  return {
    version: 2,
    current_profile: parsed.current_profile ?? null,
    profiles: parsed.profiles ?? {},
    current_host: parsed.current_host ?? null,
    hosts: parsed.hosts ?? {},
  };
}

function migrateLegacyConfig(parsed: any, configPath: string): Config {
  const legacyHosts = (parsed.hosts ?? {}) as Record<string, HostConfig>;
  const profiles: Record<string, ProfileConfig> = {};
  const hostToAlias = new Map<string, string>();

  for (const [hostKey, hostConfig] of Object.entries(legacyHosts)) {
    const alias = deriveProfileAlias(hostKey, Object.keys(profiles));
    profiles[alias] = {
      instance: hostKey.startsWith("http")
        ? hostKey
        : `${hostConfig.protocol || "https"}://${hostKey}`,
      token: hostConfig.token,
      token_type: hostConfig.token_type,
      ...(hostConfig.username ? { username: hostConfig.username } : {}),
      ...(hostConfig.default_db !== undefined ? { default_db: hostConfig.default_db } : {}),
    };
    hostToAlias.set(hostKey, alias);
  }

  const migrated: Config = {
    version: 2,
    current_profile: parsed.current_host
      ? hostToAlias.get(parsed.current_host) ?? null
      : null,
    profiles,
    hosts: {},
    current_host: null,
  };

  writeFileSync(configPath, stringify(migrated), "utf-8");
  process.stderr.write("Migrated config to Profile schema (version 2).\n");
  return migrated;
}

export function normalizeHostKey(raw: string): string {
  const trimmed = raw.trim();
  const candidate = trimmed.startsWith("http") ? trimmed : `https://${trimmed}`;

  try {
    const url = new URL(candidate);
    const pathname = url.pathname.replace(/\/+$/, "");
    return `${url.host}${pathname === "" || pathname === "/" ? "" : pathname}`;
  } catch {
    return trimmed.replace(/\/+$/, "");
  }
}

export function deriveProfileAlias(
  hostKey: string,
  usedAliases: Iterable<string> = []
): string {
  const used = new Set(Array.from(usedAliases, (alias) => alias.toLowerCase()));
  const base = (hostKey.replace(/[.:/]/g, "-").trim().slice(0, 32) || "profile");
  let candidate = base;
  let suffix = 2;
  while (used.has(candidate.toLowerCase())) {
    const suffixText = `-${suffix}`;
    candidate = `${base.slice(0, Math.max(1, 32 - suffixText.length))}${suffixText}`;
    suffix += 1;
  }
  return candidate;
}

export function getProfileByAlias(
  config: Config,
  alias: string | null | undefined
): ProfileConfig | undefined {
  if (!alias) return undefined;
  return config.profiles?.[alias];
}

export function getActiveProfile(
  config: Config
): { alias: string; profile: ProfileConfig } | undefined {
  const alias = config.current_profile;
  const profile = getProfileByAlias(config, alias);
  if (!alias || !profile) return undefined;
  return { alias, profile };
}

export function findProfileAliasByHost(config: Config, hostKey: string): string | undefined {
  for (const [alias, profile] of Object.entries(config.profiles ?? {})) {
    if (normalizeHostKey(profile.instance) === hostKey) {
      return alias;
    }
  }
  return undefined;
}

export function resolveHost(opts: GlobalOptions): string | undefined {
  const raw = opts.host || process.env.MB_HOST;
  if (!raw) {
    const config = loadConfig();
    const selectedProfile = getProfileByAlias(
      config,
      opts.profile || process.env.MB_PROFILE
    );
    if (selectedProfile) {
      return normalizeHostKey(selectedProfile.instance);
    }
    const activeProfile = getActiveProfile(config);
    if (activeProfile) {
      return normalizeHostKey(activeProfile.profile.instance);
    }
    return config.current_host ?? undefined;
  }
  return normalizeHostKey(raw);
}

export function resolveHostUrl(opts: GlobalOptions): string | undefined {
  const raw = opts.host || process.env.MB_HOST;
  if (raw) {
    // Ensure it has a protocol
    return raw.startsWith("http") ? raw : `https://${raw}`;
  }
  const config = loadConfig();
  const selectedProfile = getProfileByAlias(
    config,
    opts.profile || process.env.MB_PROFILE
  );
  if (selectedProfile) {
    return selectedProfile.instance;
  }
  const activeProfile = getActiveProfile(config);
  if (activeProfile) {
    return activeProfile.profile.instance;
  }
  const host = config.current_host;
  if (!host) return undefined;
  const hostConfig = config.hosts[host];
  const protocol = hostConfig?.protocol || "https";
  return `${protocol}://${host}`;
}

export function resolveDefaultDb(opts: GlobalOptions & { db?: number }): number | undefined {
  if (opts.db) return opts.db;
  const envDb = process.env.MB_DEFAULT_DB;
  if (envDb) return parseInt(envDb, 10);
  const config = loadConfig();
  const selectedProfile = getProfileByAlias(
    config,
    opts.profile || process.env.MB_PROFILE
  );
  if (selectedProfile) {
    return selectedProfile.default_db;
  }
  const activeProfile = getActiveProfile(config);
  if (activeProfile) {
    return activeProfile.profile.default_db;
  }
  const host = config.current_host;
  if (host && config.hosts[host]) {
    return config.hosts[host].default_db;
  }
  return undefined;
}

export function resolveFormat(opts: GlobalOptions): "json" | "csv" | "table" {
  if (opts.format) return opts.format;
  const envFormat = process.env.MB_FORMAT;
  if (envFormat && ["json", "csv", "table"].includes(envFormat)) {
    return envFormat as "json" | "csv" | "table";
  }
  return "json";
}
