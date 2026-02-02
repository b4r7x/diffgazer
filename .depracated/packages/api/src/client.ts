import type { ApiClient, ApiClientConfig, ApiError, StreamOptions } from "./types.js";

function createApiError(message: string, status: number, code?: string): ApiError {
  const error = new Error(message) as ApiError;
  error.status = status;
  error.code = code;
  return error;
}

export function createApiClient(config: ApiClientConfig): ApiClient {
  const { baseUrl } = config;

  async function parse<T>(response: Response): Promise<T> {
    const body = await response.json().catch(() => null);
    if (body === null) {
      throw createApiError("Invalid JSON response", response.status);
    }
    return body as T;
  }

  async function send(
    method: string,
    path: string,
    options?: { body?: unknown; params?: Record<string, string>; signal?: AbortSignal }
  ): Promise<Response> {
    let url = `${baseUrl}${path}`;
    if (options?.params) {
      const queryString = new URLSearchParams(options.params).toString();
      if (queryString) url += `?${queryString}`;
    }

    console.log("[CLIENT:FETCH]", method, url);

    const headers: Record<string, string> = { Accept: "application/json" };
    if (options?.body !== undefined) {
      headers["Content-Type"] = "application/json";
    }

    const response = await fetch(url, {
      method,
      headers,
      body: options?.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: options?.signal,
    });

    console.log("[CLIENT:RESPONSE]", response.status, response.statusText, "hasBody:", !!response.body);

    if (!response.ok) {
      const responseBody = (await response.json().catch(() => null)) as {
        error?: { message?: string; code?: string };
      } | null;
      console.error("[CLIENT:ERROR]", response.status, responseBody);
      throw createApiError(responseBody?.error?.message ?? `HTTP ${response.status}`, response.status, responseBody?.error?.code);
    }

    return response;
  }

  return {
    get: async <T>(path: string, params?: Record<string, string>): Promise<T> => {
      const response = await send("GET", path, { params });
      return parse<T>(response);
    },
    post: async <T>(path: string, body?: unknown): Promise<T> => {
      const response = await send("POST", path, { body });
      return parse<T>(response);
    },
    put: async <T>(path: string, body?: unknown): Promise<T> => {
      const response = await send("PUT", path, { body });
      return parse<T>(response);
    },
    delete: async <T>(path: string): Promise<T> => {
      const response = await send("DELETE", path);
      return parse<T>(response);
    },
    stream: (path: string, options?: StreamOptions) => send("GET", path, options),
    request: send,
  };
}
