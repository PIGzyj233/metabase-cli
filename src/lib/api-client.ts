import {
  resolveToken,
  getAuthHeader,
  loginWithPassword,
  storeToken,
  type TokenInfo,
} from "./auth.js";
import { resolveHostUrl, resolveHost } from "./config.js";
import type { GlobalOptions } from "../types/index.js";

export class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export interface ApiClient {
  get(path: string, params?: Record<string, string>): Promise<any>;
  post(path: string, body?: any): Promise<any>;
  delete(path: string): Promise<any>;
}

export function createApiClient(opts: GlobalOptions): ApiClient {
  const resolvedUrl = resolveHostUrl(opts);
  if (!resolvedUrl) {
    throw new ApiError(0, "No Metabase host configured. Set MB_HOST or run 'mb auth login'.");
  }
  const baseUrl: string = resolvedUrl;

  async function request(
    method: string,
    path: string,
    body?: any,
    isRetry = false
  ): Promise<any> {
    const tokenInfo = resolveToken(opts);
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (tokenInfo) {
      Object.assign(headers, getAuthHeader(tokenInfo));
    }

    const url = `${baseUrl}${path}`;

    const res = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (res.status === 401 && !isRetry) {
      // Try auto-renewal
      const username = process.env.MB_USERNAME ?? "";
      const password = process.env.MB_PASSWORD ?? "";
      if (username && password) {
        const newToken = await loginWithPassword(baseUrl, username, password);
        const host = resolveHost(opts);
        if (host) {
          const protocol = new URL(baseUrl).protocol.replace(":", "");
          storeToken(host, protocol, newToken, "session", username);
        }
        // Retry with new token
        const retryTokenInfo: TokenInfo = { token: newToken, type: "session" };
        const retryHeaders: Record<string, string> = {
          "Content-Type": "application/json",
          ...getAuthHeader(retryTokenInfo),
        };
        const retryRes = await fetch(url, {
          method,
          headers: retryHeaders,
          body: body ? JSON.stringify(body) : undefined,
        });
        if (!retryRes.ok) {
          const retryBody = await retryRes.json().catch(() => ({}));
          throw new ApiError(
            retryRes.status,
            retryBody.message || `HTTP ${retryRes.status}`
          );
        }
        return retryRes.json();
      }
      throw new ApiError(
        401,
        "Not authenticated. Run 'mb auth login' first."
      );
    }

    if (!res.ok) {
      const errorBody = await res.json().catch(() => ({}));
      throw new ApiError(
        res.status,
        errorBody.message || `HTTP ${res.status}`
      );
    }

    return res.json();
  }

  return {
    get(path: string, params?: Record<string, string>) {
      let url = path;
      if (params) {
        const qs = new URLSearchParams(params).toString();
        url = `${path}?${qs}`;
      }
      return request("GET", url);
    },
    post(path: string, body?: any) {
      return request("POST", path, body);
    },
    delete(path: string) {
      return request("DELETE", path);
    },
  };
}
