import { vi } from "vitest";

interface MockResponse {
  status: number;
  body: any;
  headers?: Record<string, string>;
}

let mockResponses: MockResponse[] = [];
let fetchCalls: { url: string; init?: RequestInit }[] = [];

export function mockFetch(responses: MockResponse[]) {
  mockResponses = [...responses];
  fetchCalls = [];

  const mockFn = vi.fn(async (url: string, init?: RequestInit) => {
    fetchCalls.push({ url, init });
    const response = mockResponses.shift();
    if (!response) {
      throw new Error(`No mock response for ${url}`);
    }
    return {
      ok: response.status >= 200 && response.status < 300,
      status: response.status,
      statusText: response.status === 200 ? "OK" : "Error",
      json: async () => {
        if (response.body === null || response.body === undefined) {
          throw new SyntaxError("Unexpected end of JSON input");
        }
        return response.body;
      },
      text: async () => JSON.stringify(response.body),
      headers: new Headers(response.headers || {}),
    } as Response;
  });

  vi.stubGlobal("fetch", mockFn);
  return mockFn;
}

export function getFetchCalls() {
  return fetchCalls;
}

export function resetMock() {
  mockResponses = [];
  fetchCalls = [];
  vi.unstubAllGlobals();
}
