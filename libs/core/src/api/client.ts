import { getErrorMessage } from "../errors.js";
import { redactSecrets, truncateUtf8 } from "../redaction.js";
import { sanitizeTerminalText } from "../sanitize-terminal.js";
import { ApiErrorEnvelopeSchema, ErrorCode } from "../schemas/errors.js";
import { PROJECT_ROOT_HEADER, SHUTDOWN_TOKEN_HEADER } from "./protocol.js";
import type {
  ApiClient,
  ApiClientConfig,
  ApiError,
  BodyRequestOptions,
  QueryRequestOptions,
  RequestOptions,
  ResponseValidator,
} from "./types.js";

const ERROR_RESPONSE_CAPTURE_MAX_BYTES = 64 * 1024;
const SAFE_MESSAGE_MAX_BYTES = 512;
const CODE_MAX_BYTES = 128;
const INVALID_JSON = Symbol("invalid-json");

const SENSITIVE_HEADER_PATTERN =
  /\b(?:x[-_](?:api[-_]?key|auth(?:orization)?|access[-_]?token|credential|secret)|api[-_]?key|access[-_]?token)\s*[:=]/i;
// Validators and HTTP envelopes can carry arbitrary provider/server output.
// Treat shell-like command fragments as untrusted even when they do not carry
// a recognizable credential marker (for example, `echo <secret>`).
const COMMAND_FRAGMENT_PATTERN =
  /(?:^|[\s;&|])(?:echo|printf|cat|curl|wget|nc|netcat|sh|bash|zsh|fish|node|python(?:\d*)?|ruby|perl|powershell|pwsh|cmd(?:\.exe)?)(?:\s|$)/i;
const BODY_SECRET_KEYS = new Set([
  "apikey",
  "accesstoken",
  "auth",
  "authtoken",
  "authorization",
  "bearer",
  "bearertoken",
  "clientsecret",
  "credential",
  "credentials",
  "password",
  "passwd",
  "privatekey",
  "secret",
  "secretkey",
  "token",
]);
/**
 * Shown whenever a response fails its schema: the app and the server disagree
 * about the payload shape, which in practice means they are running different
 * builds. Restarting reloads both sides, so that is the action offered.
 */
const RESPONSE_VALIDATION_MESSAGE =
  "The server returned data this build does not understand. Restart Diffgazer so the app and server run the same build.";

const BODY_SECRET_SCAN_MAX_DEPTH = 16;
const BODY_SECRET_SCAN_MAX_NODES = 512;
const BODY_SECRET_VALUE_MAX_COUNT = 64;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function sanitizeText(
  value: unknown,
  sensitiveValues: readonly string[],
  maxBytes: number,
): string | undefined {
  if (typeof value !== "string") return undefined;
  const sanitized = sanitizeTerminalText(redactSecrets(value, sensitiveValues))
    .replace(/\s+/g, " ")
    .trim();
  if (sanitized.length === 0) return undefined;
  return truncateUtf8(sanitized, maxBytes);
}

/**
 * A schema validator rejects with an issue list whose `message` is the serialized
 * issues themselves. That text is machine output, never user copy, so it is
 * recognised by shape rather than by class: the validator instance that threw may
 * come from a different copy of the schema library than the one linked here.
 */
function isSchemaValidationFailure(cause: unknown): boolean {
  return isRecord(cause) && Array.isArray((cause as { issues?: unknown }).issues);
}

function isUntrustedDiagnostic(value: string): boolean {
  return (
    COMMAND_FRAGMENT_PATTERN.test(value) ||
    /\b(?:stderr|stdout|stack\s*trace|traceback|subprocess|executable|command\s*[:=]|child\s*process|(?:provider|cli)\s+(?:output|stderr|stdout|error|diagnostic)|raw\s+response)\b/i.test(
      value,
    ) ||
    /\b(?:authorization|proxy-authorization|cookie|set-cookie)\s*[:=]/i.test(value) ||
    SENSITIVE_HEADER_PATTERN.test(value) ||
    /\b(?:auth(?:entication)?[-_ ]?path|path|executable(?:[-_ ]?path)?|file)\s*[:=]\s*["'`]?\s*(?:~|\/|[A-Za-z]:[\\/]|\\\\)/i.test(
      value,
    )
  );
}

function getConfiguredSensitiveValues(
  config: ApiClientConfig,
  requestHeaders?: Record<string, string>,
  requestBody?: unknown,
): string[] {
  const values: string[] = [];
  const token = resolveToken(config.shutdownToken);
  if (token) values.push(token);
  if (config.projectRoot) values.push(config.projectRoot);

  for (const headers of [config.headers, requestHeaders]) {
    if (!headers) continue;
    for (const [name, value] of Object.entries(headers)) {
      if (
        /authorization|cookie|token|secret|password|credential|api[-_ ]?key/i.test(name) &&
        value
      ) {
        values.push(value);
      }
    }
  }

  values.push(...collectBodySecretValues(requestBody));
  return values;
}

function isBodySecretKey(key: string): boolean {
  return BODY_SECRET_KEYS.has(key.replace(/[^a-z0-9]/gi, "").toLowerCase());
}

function collectBodySecretValues(body: unknown): string[] {
  const values: string[] = [];
  const seen = new WeakSet<object>();
  let scannedNodes = 0;

  const visit = (value: unknown, isSecretContext: boolean, depth: number): void => {
    if (values.length >= BODY_SECRET_VALUE_MAX_COUNT || depth > BODY_SECRET_SCAN_MAX_DEPTH) return;
    if (typeof value === "string") {
      if (isSecretContext && value.length > 0) values.push(value);
      return;
    }
    if (value === null || typeof value !== "object" || scannedNodes >= BODY_SECRET_SCAN_MAX_NODES) {
      return;
    }
    if (seen.has(value)) return;
    seen.add(value);
    scannedNodes += 1;

    let entries: [string, unknown][];
    try {
      entries = Object.entries(value);
    } catch {
      return;
    }
    for (const [key, child] of entries) {
      visit(child, isSecretContext || isBodySecretKey(key), depth + 1);
      if (values.length >= BODY_SECRET_VALUE_MAX_COUNT) return;
    }
  };

  visit(body, false, 0);
  return values;
}

function createApiError(message: string, status: number, code?: string): ApiError {
  return Object.assign(new Error(message), { status, code });
}

function resolveToken(
  shutdownToken: string | (() => string | undefined) | undefined,
): string | undefined {
  const token = typeof shutdownToken === "function" ? shutdownToken() : shutdownToken;
  const normalized = token?.trim();
  return normalized || undefined;
}

type ResponseBodyReader = {
  read: () => Promise<{
    done: boolean;
    value?: unknown;
  }>;
  cancel?: (reason?: unknown) => Promise<unknown> | unknown;
};

function responseContentLength(response: Response): number | undefined {
  try {
    const value = response.headers?.get?.("content-length");
    if (value === null || value === undefined || value.trim() === "") return undefined;
    const length = Number(value);
    return Number.isFinite(length) && length >= 0 ? length : undefined;
  } catch {
    return undefined;
  }
}

function cancelBestEffort(
  target: { cancel?: (reason?: unknown) => Promise<unknown> | unknown } | null | undefined,
  reason: unknown,
): void {
  if (!target || typeof target.cancel !== "function") return;
  try {
    void Promise.resolve(target.cancel(reason)).catch(() => undefined);
  } catch {
    // Cancellation is advisory. The bounded-read result must not depend on
    // whether an upstream/test-double cleanup hook is well behaved.
  }
}

function asResponseChunk(value: unknown): Uint8Array | undefined {
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  }
  return undefined;
}

function getResponseBodyReader(response: Response): ResponseBodyReader | undefined {
  const body = response.body as (ReadableStream<Uint8Array> & { getReader?: () => unknown }) | null;
  if (!body || typeof body.getReader !== "function") return undefined;
  try {
    const reader = body.getReader() as ResponseBodyReader;
    return typeof reader?.read === "function" ? reader : undefined;
  } catch {
    return undefined;
  }
}

export function createApiClient(config: ApiClientConfig): ApiClient {
  const { baseUrl, projectRoot, headers: baseHeaders } = config;
  const normalizedBaseUrl = baseUrl.replace(/\/+$/, "");

  const projectHeaders: Record<string, string> = { ...baseHeaders };
  if (projectRoot) {
    projectHeaders[PROJECT_ROOT_HEADER] = encodeURIComponent(projectRoot);
  }

  async function readJson(
    response: Response,
    maxCaptureBytes: number,
  ): Promise<unknown | typeof INVALID_JSON> {
    const contentLength = responseContentLength(response);
    const body = response.body as
      | (ReadableStream<Uint8Array> & {
          cancel?: (reason?: unknown) => Promise<unknown> | unknown;
        })
      | null;
    if (contentLength !== undefined && contentLength > maxCaptureBytes) {
      cancelBestEffort(body, new Error("Response body exceeds the capture limit"));
      return INVALID_JSON;
    }

    const reader = getResponseBodyReader(response);
    if (!reader) return INVALID_JSON;

    const decoder = new TextDecoder();
    let capturedBytes = 0;
    let rawText = "";
    try {
      while (true) {
        const result = await reader.read();
        if (result.done) break;

        const chunk = asResponseChunk(result.value);
        if (!chunk) {
          cancelBestEffort(reader, new Error("Response body contained a non-byte chunk"));
          return INVALID_JSON;
        }

        if (chunk.byteLength > maxCaptureBytes - capturedBytes) {
          cancelBestEffort(reader, new Error("Response body exceeds the capture limit"));
          return INVALID_JSON;
        }
        capturedBytes += chunk.byteLength;
        rawText += decoder.decode(chunk, { stream: true });
      }
      rawText += decoder.decode();
    } catch {
      cancelBestEffort(reader, new Error("Failed to read response body"));
      return INVALID_JSON;
    }

    try {
      return JSON.parse(rawText.replace(/^\uFEFF/, "")) as unknown;
    } catch {
      return INVALID_JSON;
    }
  }

  async function parse<T>(
    response: Response,
    validate: ResponseValidator<T> | undefined,
    sensitiveValues: readonly string[],
    maxCaptureBytes: number,
  ): Promise<T> {
    const body = await readJson(response, maxCaptureBytes);
    if (body === INVALID_JSON || body === null) {
      throw createApiError("Invalid JSON response", response.status);
    }
    if (validate) {
      try {
        return validate(body);
      } catch (cause) {
        const rawMessage = getErrorMessage(cause, RESPONSE_VALIDATION_MESSAGE);
        const sanitizedMessage =
          sanitizeText(rawMessage, sensitiveValues, SAFE_MESSAGE_MAX_BYTES) ??
          RESPONSE_VALIDATION_MESSAGE;
        const message =
          isSchemaValidationFailure(cause) || isUntrustedDiagnostic(rawMessage)
            ? RESPONSE_VALIDATION_MESSAGE
            : sanitizedMessage;
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

    const sensitiveValues = getConfiguredSensitiveValues(config, options?.headers, options?.body);
    let response: Response;
    try {
      response = await fetch(url, {
        method,
        headers,
        body: options?.body !== undefined ? JSON.stringify(options.body) : undefined,
        signal: options?.signal,
        keepalive: options?.keepalive,
      });
    } catch (cause) {
      const rawMessage = getErrorMessage(cause, "Network request failed");
      const sanitizedMessage = sanitizeText(rawMessage, sensitiveValues, SAFE_MESSAGE_MAX_BYTES);
      throw new Error(
        sanitizedMessage && !isUntrustedDiagnostic(rawMessage)
          ? sanitizedMessage
          : "Network request failed",
      );
    }

    if (!response.ok) {
      const rawBody = await readJson(response, ERROR_RESPONSE_CAPTURE_MAX_BYTES);
      if (rawBody === INVALID_JSON || rawBody === null) {
        throw createApiError(`HTTP ${response.status}`, response.status);
      }
      const envelope = ApiErrorEnvelopeSchema.safeParse(rawBody);
      const error = envelope.success ? envelope.data.error : undefined;
      // The rest of the wire envelope is server/provider-controlled diagnostic
      // data with no client consumer. It never reaches the thrown error: only
      // the validated envelope message, status and code do.
      const rawMessage = error?.message ?? `HTTP ${response.status}`;
      const sanitizedMessage =
        sanitizeText(rawMessage, sensitiveValues, SAFE_MESSAGE_MAX_BYTES) ??
        `HTTP ${response.status}`;
      const message = isUntrustedDiagnostic(rawMessage)
        ? `HTTP ${response.status}`
        : sanitizedMessage;

      const code = sanitizeText(error?.code, sensitiveValues, CODE_MAX_BYTES);
      throw createApiError(message, response.status, code);
    }

    return response;
  }

  async function query<T>(
    method: "GET" | "DELETE",
    path: string,
    options?: QueryRequestOptions<T>,
  ): Promise<T> {
    const { schema, maxResponseBytes, ...request } = options ?? {};
    const response = await send(method, path, request);
    return parse<T>(
      response,
      schema,
      getConfiguredSensitiveValues(config, request.headers),
      maxResponseBytes ?? ERROR_RESPONSE_CAPTURE_MAX_BYTES,
    );
  }

  async function withPostBody<T>(
    path: string,
    body?: unknown,
    options?: BodyRequestOptions<T>,
  ): Promise<T> {
    const { schema, maxResponseBytes, ...request } = options ?? {};
    const response = await send("POST", path, { body, ...request });
    return parse<T>(
      response,
      schema,
      getConfiguredSensitiveValues(config, request.headers, body),
      maxResponseBytes ?? ERROR_RESPONSE_CAPTURE_MAX_BYTES,
    );
  }

  return {
    get: (path, options) => query("GET", path, options),
    delete: (path, options) => query("DELETE", path, options),
    post: (path, body, options) => withPostBody(path, body, options),
    request: send,
  };
}
