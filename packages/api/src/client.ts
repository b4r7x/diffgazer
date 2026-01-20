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
    const data = (await response.json().catch(() => null)) as {
      success?: boolean;
      data?: T;
      error?: { message?: string; code?: string };
    } | null;

    if (data === null) {
      throw createApiError("Invalid JSON response", response.status);
    }

    if (data.success === false) {
      throw createApiError(
        data.error?.message ?? "Request failed",
        response.status,
        data.error?.code
      );
    }

    return (data.data ?? data) as T;
  }

  async function send(
    method: string,
    path: string,
    opts?: { body?: unknown; params?: Record<string, string>; signal?: AbortSignal }
  ): Promise<Response> {
    let url = `${baseUrl}${path}`;
    if (opts?.params) {
      const qs = new URLSearchParams(opts.params).toString();
      if (qs) url += `?${qs}`;
    }

    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: opts?.body ? JSON.stringify(opts.body) : undefined,
      signal: opts?.signal,
    });

    if (!response.ok) {
      const data = (await response.json().catch(() => null)) as {
        error?: { message?: string; code?: string };
      } | null;
      throw createApiError(data?.error?.message ?? `HTTP ${response.status}`, response.status, data?.error?.code);
    }

    return response;
  }

  async function json<T>(method: string, path: string, opts?: { body?: unknown; params?: Record<string, string> }): Promise<T> {
    return parse<T>(await send(method, path, opts));
  }

  return {
    get: <T>(path: string, params?: Record<string, string>) => json<T>("GET", path, { params }),
    post: <T>(path: string, body?: unknown) => json<T>("POST", path, { body }),
    put: <T>(path: string, body?: unknown) => json<T>("PUT", path, { body }),
    delete: <T>(path: string) => json<T>("DELETE", path),
    stream: (path: string, opts?: StreamOptions) => send("GET", path, opts),
    request: send,
  };
}
