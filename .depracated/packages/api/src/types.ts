export interface ApiClientConfig {
  baseUrl: string;
}

export interface ApiError extends Error {
  status: number;
  code?: string;
}

export interface RequestOptions {
  body?: unknown;
  params?: Record<string, string>;
  signal?: AbortSignal;
}

export type StreamOptions = Omit<RequestOptions, "body">;

export interface ApiClient {
  get: <T>(path: string, params?: Record<string, string>) => Promise<T>;
  post: <T>(path: string, body?: unknown) => Promise<T>;
  put: <T>(path: string, body?: unknown) => Promise<T>;
  delete: <T>(path: string) => Promise<T>;
  stream: (path: string, options?: StreamOptions) => Promise<Response>;
  request: (method: string, path: string, options?: RequestOptions) => Promise<Response>;
}
