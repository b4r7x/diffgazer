import { getErrorMessage } from "../errors.js";
import { sanitizeTerminalText } from "../review/sanitize-terminal.js";
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

const RESPONSE_CAPTURE_MAX_BYTES = 64 * 1024;
const SAFE_MESSAGE_MAX_BYTES = 512;
const CODE_MAX_BYTES = 128;
const REDACTED = "[REDACTED]";
const GENERIC_REMEDIATION = "Review the error and try again.";
const INVALID_JSON = Symbol("invalid-json");

type ApiErrorMetadata = {
  /** A static client-owned hint; never copy wire remediation text. */
  remediation?: string;
  retryable?: boolean;
  safeMessage?: string;
};

type SafeApiError = ApiError & ApiErrorMetadata;

const ABSOLUTE_PATH_PATTERN =
  /(^|[\s("'=:\u00a0])((?:~|\/(?:Users|home|private\/var|var\/folders|tmp|opt|etc|usr|bin|sbin|srv|run|root)(?:\/|$)|[A-Za-z]:[\\/](?:Users|home|AppData|ProgramData|Program Files|Windows)(?:[\\/]|$))[^\s"'`<>{},;)]*)/gi;
const LABELED_PATH_PATTERN =
  /\b(?:auth(?:entication)?[-_ ]?path|path|executable(?:[-_ ]?path)?|file)\s*[:=]\s*["'`]?\s*(?:~|\/|[A-Za-z]:[\\/]|\\\\)[^\s"'`<>{},;)]*/gi;
const AUTH_HEADER_PATTERN =
  /\b(?:authorization|proxy-authorization|cookie|set-cookie)\s*[:=]\s*(?:(?:bearer|basic)\s+)?[^\s,;]+/gi;
const BEARER_PATTERN = /\b(?:bearer|basic)\s+[^\s,;]+/gi;
const SECRET_ASSIGNMENT_PATTERN =
  /\b(?:api(?:[-_ ]?key)|access[-_ ]?token|auth(?:orization)?|credential|password|passwd|secret|token|private[-_ ]?key|client[-_ ]?secret)\b\s*(?:[:=]|\bis\s*)\s*["'`]?[^\s"'`,;)}\]]+/gi;
const SECRET_FLAG_PATTERN =
  /--?(?:api(?:[-_ ]?key)|auth(?:orization)?|bearer|cookie|credential|password|secret|token)\s+(?:["'`][^"'`]+["'`]|[^\s]+)/gi;
const ENV_SECRET_PATTERN =
  /\b[A-Z][A-Z0-9]*(?:[_-](?:API[_-]?KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL|AUTH(?:ORIZATION)?|COOKIE))\b\s*=\s*[^\s,;]+/g;
const TOKEN_PATTERN =
  /\b(?:sk|pk|rk|ghp|github_pat|AIza|ya29|xox[baprs]-)[A-Za-z0-9._~+\x2f-]{8,}=*/gi;
const PRIVATE_KEY_PATTERN =
  /-----BEGIN [A-Z ]+PRIVATE KEY-----[\s\S]*?-----END [A-Z ]+PRIVATE KEY-----/gi;
const ACCOUNT_ASSIGNMENT_PATTERN =
  /\b(?:account(?:[-_ ]?id)?|workspace(?:[-_ ]?id)?|organization(?:[-_ ]?id)?|org(?:[-_ ]?id)?|tenant(?:[-_ ]?id)?|project(?:[-_ ]?id)?|subscription(?:[-_ ]?id)?)\b\s*(?:[:=]|\bis\s*)\s*["'`]?[^\s"'`,;)}\]]+/gi;
const ACCOUNT_IDENTIFIER_PATTERN =
  /\b(?:acct|account|workspace|organization|org|tenant|project|subscription)[._-][A-Za-z0-9._-]{4,}\b/gi;
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
const BODY_SECRET_SCAN_MAX_DEPTH = 16;
const BODY_SECRET_SCAN_MAX_NODES = 512;
const BODY_SECRET_VALUE_MAX_COUNT = 64;

function utf8ByteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

function truncateUtf8(value: string, maxBytes: number): string {
  if (utf8ByteLength(value) <= maxBytes) return value;

  let output = "";
  let bytes = 0;
  for (const character of value) {
    const characterBytes = utf8ByteLength(character);
    if (bytes + characterBytes > maxBytes) break;
    output += character;
    bytes += characterBytes;
  }
  return output;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function redact(value: string, sensitiveValues: readonly string[]): string {
  let redacted = value;

  // Exact configured values are replaced before generic patterns. This keeps
  // short-lived credentials safe even when they do not have a recognizable
  // token prefix and ensures redaction happens before any byte bound.
  for (const sensitiveValue of [...sensitiveValues].sort((a, b) => b.length - a.length)) {
    if (sensitiveValue.length === 0) continue;
    redacted = redacted.replace(new RegExp(escapeRegExp(sensitiveValue), "g"), REDACTED);
  }

  return redacted
    .replace(PRIVATE_KEY_PATTERN, REDACTED)
    .replace(AUTH_HEADER_PATTERN, REDACTED)
    .replace(BEARER_PATTERN, REDACTED)
    .replace(SECRET_ASSIGNMENT_PATTERN, REDACTED)
    .replace(SECRET_FLAG_PATTERN, REDACTED)
    .replace(ENV_SECRET_PATTERN, REDACTED)
    .replace(TOKEN_PATTERN, REDACTED)
    .replace(ACCOUNT_ASSIGNMENT_PATTERN, REDACTED)
    .replace(ACCOUNT_IDENTIFIER_PATTERN, REDACTED)
    .replace(LABELED_PATH_PATTERN, REDACTED)
    .replace(ABSOLUTE_PATH_PATTERN, `$1${REDACTED}`);
}

function sanitizeText(
  value: unknown,
  sensitiveValues: readonly string[],
  maxBytes: number,
): string | undefined {
  if (typeof value !== "string") return undefined;
  const sanitized = sanitizeTerminalText(redact(value, sensitiveValues))
    .replace(/\s+/g, " ")
    .trim();
  if (sanitized.length === 0) return undefined;
  return truncateUtf8(sanitized, maxBytes);
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

function createApiError(
  message: string,
  status: number,
  code?: string,
  metadata?: ApiErrorMetadata,
): SafeApiError {
  const error = new Error(message) as SafeApiError;
  error.status = status;
  error.code = code;
  Object.assign(error, metadata);
  return error;
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

  async function readJsonFallback(response: Response): Promise<unknown | typeof INVALID_JSON> {
    // A body-less Response is not produced by fetch, but is common in tests and
    // small fetch shims. There is no bounded read primitive on Response.text()
    // or Response.json(): both may materialize an arbitrarily large value before
    // returning. Only use this compatibility path when the shim declares a
    // trustworthy, bounded content length; unknown-length fallbacks fail closed.
    const contentLength = responseContentLength(response);
    if (contentLength === undefined || contentLength > RESPONSE_CAPTURE_MAX_BYTES) {
      return INVALID_JSON;
    }

    try {
      const rawText = await response.text();
      if (typeof rawText !== "string" || utf8ByteLength(rawText) > RESPONSE_CAPTURE_MAX_BYTES) {
        return INVALID_JSON;
      }
      return JSON.parse(rawText.replace(/^\uFEFF/, "")) as unknown;
    } catch {
      try {
        const body = await response.json();
        const serialized = JSON.stringify(body);
        if (
          typeof serialized !== "string" ||
          utf8ByteLength(serialized) > RESPONSE_CAPTURE_MAX_BYTES
        ) {
          return INVALID_JSON;
        }
        return body;
      } catch {
        return INVALID_JSON;
      }
    }
  }

  async function readJson(response: Response): Promise<unknown | typeof INVALID_JSON> {
    const contentLength = responseContentLength(response);
    const body = response.body as
      | (ReadableStream<Uint8Array> & {
          cancel?: (reason?: unknown) => Promise<unknown> | unknown;
        })
      | null;
    if (contentLength !== undefined && contentLength > RESPONSE_CAPTURE_MAX_BYTES) {
      cancelBestEffort(body, new Error("Response body exceeds the 64 KiB capture limit"));
      return INVALID_JSON;
    }

    const reader = getResponseBodyReader(response);
    if (!reader) return readJsonFallback(response);

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

        if (chunk.byteLength > RESPONSE_CAPTURE_MAX_BYTES - capturedBytes) {
          cancelBestEffort(reader, new Error("Response body exceeds the 64 KiB capture limit"));
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
    validate?: ResponseValidator<T>,
    sensitiveValues: readonly string[] = [],
  ): Promise<T> {
    const body = await readJson(response);
    if (body === INVALID_JSON || body === null) {
      throw createApiError("Invalid JSON response", response.status);
    }
    if (validate) {
      try {
        return validate(body);
      } catch (cause) {
        const rawMessage = getErrorMessage(cause, "Response validation failed");
        const safeMessage =
          sanitizeText(rawMessage, sensitiveValues, SAFE_MESSAGE_MAX_BYTES) ??
          "Response validation failed";
        const message = isUntrustedDiagnostic(rawMessage)
          ? "Response validation failed"
          : safeMessage;
        throw createApiError(message, 422, ErrorCode.INVALID_RESPONSE, {
          safeMessage: message,
        });
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
      });
    } catch (cause) {
      const rawMessage = getErrorMessage(cause, "Network request failed");
      const safeMessage = sanitizeText(rawMessage, sensitiveValues, SAFE_MESSAGE_MAX_BYTES);
      throw new Error(
        safeMessage && !isUntrustedDiagnostic(rawMessage) ? safeMessage : "Network request failed",
      );
    }

    if (!response.ok) {
      const rawBody = await readJson(response);
      if (rawBody === INVALID_JSON || rawBody === null) {
        throw createApiError(`HTTP ${response.status}`, response.status);
      }
      const envelope = ApiErrorEnvelopeSchema.safeParse(rawBody);
      const error = envelope.success ? envelope.data.error : undefined;
      const errorPayload = isRecord(rawBody) && isRecord(rawBody.error) ? rawBody.error : undefined;
      // `safeMessage` is still provider/server-controlled wire data. It is
      // metadata for server-side producers, not an authority for this client;
      // only the validated envelope message participates in normalization.
      const rawMessage = error?.message ?? `HTTP ${response.status}`;
      const safeMessage =
        sanitizeText(rawMessage, sensitiveValues, SAFE_MESSAGE_MAX_BYTES) ??
        `HTTP ${response.status}`;
      const message = isUntrustedDiagnostic(rawMessage) ? `HTTP ${response.status}` : safeMessage;

      const metadata: ApiErrorMetadata = { safeMessage: message };
      if (typeof errorPayload?.retryable === "boolean") {
        metadata.retryable = errorPayload.retryable;
      }

      // The legacy envelope can contain arbitrary diagnostic keys. Those
      // values are server/provider-controlled and therefore are not a
      // client-safe contract, even after pattern redaction: an opaque value
      // can be a secret without matching a recognizable token shape. Keep
      // status/code/retryable and expose only a static, client-owned hint when
      // the server indicates that remediation exists. Never persist or return
      // details, truncatedDetails, correlationId, or wire remediation text.
      if (typeof errorPayload?.remediation === "string") {
        metadata.remediation = GENERIC_REMEDIATION;
      }

      const code = sanitizeText(error?.code, sensitiveValues, CODE_MAX_BYTES);
      throw createApiError(message, response.status, code, metadata);
    }

    return response;
  }

  async function query<T>(
    method: "GET" | "DELETE",
    path: string,
    options?: QueryRequestOptions<T>,
  ): Promise<T> {
    const { schema, ...request } = options ?? {};
    const response = await send(method, path, request);
    return parse<T>(response, schema, getConfiguredSensitiveValues(config, request.headers));
  }

  async function withBody<T>(
    method: "POST" | "PUT",
    path: string,
    body?: unknown,
    options?: BodyRequestOptions<T>,
  ): Promise<T> {
    const { schema, ...request } = options ?? {};
    const response = await send(method, path, { body, ...request });
    return parse<T>(response, schema, getConfiguredSensitiveValues(config, request.headers, body));
  }

  return {
    get: (path, options) => query("GET", path, options),
    delete: (path, options) => query("DELETE", path, options),
    post: (path, body, options) => withBody("POST", path, body, options),
    put: (path, body, options) => withBody("PUT", path, body, options),
    request: send,
  };
}
