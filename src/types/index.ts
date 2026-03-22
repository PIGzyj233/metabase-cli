export interface HostConfig {
  protocol: string;
  token: string;
  token_type: "api_key" | "session";
  username?: string;
  default_db?: number;
}

export interface Config {
  current_host?: string;
  hosts: Record<string, HostConfig>;
}

export interface GlobalOptions {
  host?: string;
  token?: string;
  format?: "json" | "csv" | "table";
  json?: string;
  jq?: string;
  omitHeader?: boolean;
}

export interface QueryResult {
  rows: any[][];
  cols: { name: string; display_name: string; base_type: string }[];
}

export interface PaginationInfo {
  total: number;
  offset: number;
  limit: number;
}

export interface ApiErrorResponse {
  message?: string;
  errors?: Record<string, string>;
}
