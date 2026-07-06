import type { TrustConfig } from "../schemas/config/index.js";
import type { ProjectContextGraph, ProjectContextMeta } from "../schemas/context.js";
import type { ErrorCode } from "../schemas/errors.js";

export interface ApiError extends Error {
  status: number;
  // Known shared wire codes (incl. the four formerly-untyped ones) autocomplete
  // and are exhaustively switchable, while server-only domain codes the client
  // does not model still flow through untyped rather than being dropped.
  code?: ErrorCode | (string & {});
}

export function isApiError(error: unknown): error is ApiError {
  return (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    typeof (error as Record<string, unknown>).status === "number" &&
    "message" in error &&
    typeof (error as Record<string, unknown>).message === "string"
  );
}

export interface RequestOptions {
  body?: unknown;
  params?: Record<string, string>;
  signal?: AbortSignal;
  headers?: Record<string, string>;
}

export interface ApiClientConfig {
  baseUrl: string;
  projectRoot?: string;
  headers?: Record<string, string>;
  shutdownToken?: string | (() => string | undefined);
}

/**
 * Validates a parsed JSON body and returns the typed value, throwing on a shape
 * mismatch. A Zod schema's `.parse` method satisfies this structurally, so
 * callers can pass `Schema.parse` to opt into runtime validation.
 */
export type ResponseValidator<T> = (body: unknown) => T;

export interface ApiClient {
  get: <T>(
    path: string,
    params?: Record<string, string>,
    schema?: ResponseValidator<T>,
    options?: Omit<RequestOptions, "body" | "params">,
  ) => Promise<T>;
  post: <T>(
    path: string,
    body?: unknown,
    options?: Omit<RequestOptions, "body" | "params">,
    schema?: ResponseValidator<T>,
  ) => Promise<T>;
  put: <T>(
    path: string,
    body?: unknown,
    options?: Omit<RequestOptions, "body" | "params">,
    schema?: ResponseValidator<T>,
  ) => Promise<T>;
  delete: <T>(
    path: string,
    params?: Record<string, string>,
    schema?: ResponseValidator<T>,
  ) => Promise<T>;
  /**
   * Issue a raw HTTP request and return the unparsed `Response`. Used for
   * streaming bodies (SSE) and any endpoint where the caller does not want
   * the client to consume the body as JSON.
   */
  request: (method: string, path: string, options?: RequestOptions) => Promise<Response>;
}

export interface TrustResponse {
  trust: TrustConfig;
}

export interface ReviewContextResponse {
  text: string;
  markdown: string;
  graph: ProjectContextGraph;
  meta: ProjectContextMeta;
}

export interface ShutdownResponse {
  ok: true;
}
