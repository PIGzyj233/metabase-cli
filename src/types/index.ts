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
  header?: boolean;
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

export interface CardCreateOptions extends GlobalOptions {
  name?: string;
  database?: string;
  sql?: string;
  display?: string;
  collection?: string;
  description?: string;
  type?: string;
  from?: string;
}

export interface CardUpdateOptions extends GlobalOptions {
  name?: string;
  description?: string;
  collection?: string;
  archived?: boolean;
  sql?: string;
  from?: string;
}
