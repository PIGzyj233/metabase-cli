import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { homedir } from "node:os";
import { parse, stringify } from "yaml";
import type { Config, GlobalOptions } from "../types/index.js";

export function getConfigDir(): string {
  return join(homedir(), ".config", "mb");
}

export function getConfigPath(): string {
  return join(getConfigDir(), "config.yml");
}

export function loadConfig(): Config {
  const configPath = getConfigPath();
  if (!existsSync(configPath)) {
    return { hosts: {} };
  }
  const content = readFileSync(configPath, "utf-8");
  const parsed = parse(content);
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

export function resolveHost(opts: GlobalOptions): string | undefined {
  const raw = opts.host || process.env.MB_HOST;
  if (!raw) {
    const config = loadConfig();
    return config.current_host;
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
