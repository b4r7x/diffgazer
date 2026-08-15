import type { TrustConfig } from "../schemas/config/index.js";
import type { ReviewContextResponse } from "../schemas/context.js";
import { ReviewContextResponseSchema } from "../schemas/context.js";
import type { ErrorCode } from "../schemas/errors.js";

export interface ApiError extends Error {
  status: number;
  // Modelled wire codes autocomplete and switch exhaustively; server-only domain
  // codes the client does not model still flow through untyped rather than
  // being dropped.
  code?: ErrorCode | (string & {});
}

export function isApiError(error: unknown): error is ApiError {
  if (!(error instanceof Error) || !("status" in error)) return false;
  if ("code" in error && error.code !== undefined && typeof error.code !== "string") return false;
  return typeof error.status === "number";
}

export interface RequestOptions {
  body?: unknown;
  params?: Record<string, string>;
  signal?: AbortSignal;
  headers?: Record<string, string>;
  /** When true, the browser may complete the request after the page unloads. */
  keepalive?: boolean;
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

/** Tail options for the query verbs (`get`, `delete`). */
export interface QueryRequestOptions<T> extends Omit<RequestOptions, "body"> {
  schema?: ResponseValidator<T>;
  maxResponseBytes?: number;
}

/** Tail options for the body verb (`post`). */
export interface BodyRequestOptions<T> extends Omit<RequestOptions, "body" | "params"> {
  schema?: ResponseValidator<T>;
  maxResponseBytes?: number;
}

export interface ApiClient {
  get: <T>(path: string, options?: QueryRequestOptions<T>) => Promise<T>;
  post: <T>(path: string, body?: unknown, options?: BodyRequestOptions<T>) => Promise<T>;
  delete: <T>(path: string, options?: QueryRequestOptions<T>) => Promise<T>;
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

export type { ReviewContextResponse };
export { ReviewContextResponseSchema };

export interface ShutdownResponse {
  ok: true;
}
