import { getErrorMessage } from "../errors.js";
import { ApiErrorEnvelopeSchema, ErrorCode } from "../schemas/errors.js";
import { PROJECT_ROOT_HEADER, SHUTDOWN_TOKEN_HEADER } from "./protocol.js";
import type {
  ApiClient,
  ApiClientConfig,
  ApiError,
  RequestOptions,
  ResponseValidator,
} from "./types.js";

function createApiError(message: string, status: number, code?: string): ApiError {
  const error = new Error(message) as ApiError;
  error.status = status;
  error.code = code;
  return error;
}

function resolveToken(
  shutdownToken: string | (() => string | undefined) | undefined,
): string | undefined {
  const token = typeof shutdownToken === "function" ? shutdownToken() : shutdownToken;
  const normalized = token?.trim();
  return normalized || undefined;
}

export function createApiClient(config: ApiClientConfig): ApiClient {
  const { baseUrl, projectRoot, headers: baseHeaders } = config;
  const normalizedBaseUrl = baseUrl.replace(/\/+$/, "");

  const projectHeaders: Record<string, string> = { ...baseHeaders };
  if (projectRoot) {
    projectHeaders[PROJECT_ROOT_HEADER] = projectRoot;
  }

  /**
   * Parses a JSON response body.
   *
   * Contract: when a `validate` function (e.g. a Zod schema's `.parse`) is
   * supplied, the body is validated and a failed validation is surfaced as a
   * structured `ApiError` (HTTP 422) rather than leaking the validator's own
   * error to the call site. When `validate` is omitted, the body is trusted as
   * `T` — the caller asserts the response shape and owns the risk of a
   * malformed payload. Prefer passing a schema for endpoints whose payload is
   * dynamic or externally controlled.
   */
  async function parse<T>(response: Response, validate?: ResponseValidator<T>): Promise<T> {
    const body = await response.json().catch(() => null);
    if (body === null) {
      throw createApiError("Invalid JSON response", response.status);
    }
    if (validate) {
      try {
        return validate(body);
      } catch (cause) {
        const message = getErrorMessage(cause, "Response validation failed");
        throw createApiError(message, 422, ErrorCode.INVALID_RESPONSE);
      }
    }
    return body as T;
  }

  async function send(method: string, path: string, options?: RequestOptions): Promise<Response> {
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;
    let url = `${normalizedBaseUrl}${normalizedPath}`;
    if (options?.params) {
      const queryString = new URLSearchParams(options.params).toString();
      if (queryString) url += `?${queryString}`;
    }

    const token = resolveToken(config.shutdownToken);
    const headers: Record<string, string> = {
      Accept: "application/json",
      ...projectHeaders,
      ...(token ? { [SHUTDOWN_TOKEN_HEADER]: token } : {}),
      ...options?.headers,
    };
    if (options?.body !== undefined) {
      headers["Content-Type"] = "application/json";
    }

    const response = await fetch(url, {
      method,
      headers,
      body: options?.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: options?.signal,
    });

    if (!response.ok) {
      const rawBody = await response.json().catch(() => null);
      const envelope = ApiErrorEnvelopeSchema.safeParse(rawBody);
      const error = envelope.success ? envelope.data.error : undefined;
      throw createApiError(
        error?.message ?? `HTTP ${response.status}`,
        response.status,
        error?.code,
      );
    }

    return response;
  }

  return {
    get: async <T>(
      path: string,
      params?: Record<string, string>,
      schema?: ResponseValidator<T>,
    ): Promise<T> => {
      const response = await send("GET", path, { params });
      return parse<T>(response, schema);
    },
    post: async <T>(
      path: string,
      body?: unknown,
      options?: Omit<RequestOptions, "body" | "params">,
      schema?: ResponseValidator<T>,
    ): Promise<T> => {
      const response = await send("POST", path, { body, ...options });
      return parse<T>(response, schema);
    },
    put: async <T>(
      path: string,
      body?: unknown,
      options?: Omit<RequestOptions, "body" | "params">,
      schema?: ResponseValidator<T>,
    ): Promise<T> => {
      const response = await send("PUT", path, { body, ...options });
      return parse<T>(response, schema);
    },
    delete: async <T>(
      path: string,
      params?: Record<string, string>,
      schema?: ResponseValidator<T>,
    ): Promise<T> => {
      const response = await send("DELETE", path, { params });
      return parse<T>(response, schema);
    },
    request: send,
  };
}
