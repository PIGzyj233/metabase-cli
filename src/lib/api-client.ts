import {
  getAuthHeader,
  loginWithPassword,
  renewProfileToken,
  resolveInvocationProfile,
} from "./auth.js";
import { humanizeQueryError } from "./error-message.js";
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
  put(path: string, body?: any, params?: Record<string, string>): Promise<any>;
  delete(path: string): Promise<any>;
}

export function createApiClient(opts: GlobalOptions): ApiClient {
  const identity = resolveInvocationProfile(opts);
  if (!identity) {
    throw new ApiError(0, "No Metabase host configured. Set MB_HOST or run 'mb auth login'.");
  }
  const resolvedIdentity = identity;
  const baseUrl: string = resolvedIdentity.baseUrl;

  async function request(
    method: string,
    path: string,
    body?: any,
    isRetry = false
  ): Promise<any> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    Object.assign(headers, getAuthHeader(resolvedIdentity.tokenInfo));

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
      if (username && password && resolvedIdentity.tokenInfo.type === "session") {
        if (resolvedIdentity.kind === "profile" && resolvedIdentity.username &&
            resolvedIdentity.username !== username) {
          throw new ApiError(401,
            `MB_USERNAME does not match Profile '${resolvedIdentity.sourceId}'. Run 'mb auth login' for this Profile.`);
        }
        const newToken = await loginWithPassword(baseUrl, username, password);
        if (resolvedIdentity.kind === "profile") {
          renewProfileToken(resolvedIdentity, newToken, username);
          resolvedIdentity.username = username;
        }
        resolvedIdentity.tokenInfo = { token: newToken, type: "session" };
        return request(method, path, body, true);
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
        humanizeQueryError(errorBody.message || `HTTP ${res.status}`)
      );
    }

    if (res.status === 204) {
      return null;
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
    put(path: string, body?: any, params?: Record<string, string>) {
      let url = path;
      if (params) {
        const qs = new URLSearchParams(params).toString();
        url = `${path}?${qs}`;
      }
      return request("PUT", url, body);
    },
    delete(path: string) {
      return request("DELETE", path);
    },
  };
}
