import http from "node:http";
import { isIP } from "node:net";
import { getErrorMessage } from "@diffgazer/core/errors";
import { err, ok, type Result } from "@diffgazer/core/result";
import type { LocalHttpAuthenticationMode } from "@diffgazer/core/schemas/config";
import { cancelResponseBody, readTextResponseWithLimit } from "../../http-json.js";
import {
  boundedFetchInit,
  type DnsLookupFn,
  type ResolvedLoopbackEndpoint,
  resolveLoopbackHttpEndpoint,
} from "../endpoints.js";

/** Paths that must never be called for local HTTP transports (REQ-032). */
const LOCAL_HTTP_FORBIDDEN_PATH_PREFIXES = [
  "/api/pull",
  "/api/push",
  "/api/create",
  "/api/delete",
  "/api/copy",
  "/api/load",
  "/api/unload",
] as const;

export function isForbiddenLocalHttpPath(pathname: string): boolean {
  const normalized = pathname.endsWith("/") && pathname !== "/" ? pathname.slice(0, -1) : pathname;
  if (LOCAL_HTTP_FORBIDDEN_PATH_PREFIXES.some((prefix) => normalized === prefix)) {
    return true;
  }
  return (
    normalized.startsWith("/v1/models/") ||
    (normalized.startsWith("/models/") && normalized !== "/models")
  );
}

export function assertReadOnlyLocalHttpPath(pathname: string): void {
  if (isForbiddenLocalHttpPath(pathname)) {
    throw new Error(`Forbidden local HTTP path: ${pathname}`);
  }
}

export type LocalHttpFetch = typeof fetch;

export type LocalHttpDependencies = Readonly<{
  fetch?: LocalHttpFetch;
  lookup?: DnsLookupFn;
  signal?: AbortSignal;
  now?: () => Date;
}>;

function defaultNow(): Date {
  return new Date();
}

export function resolveLocalHttpDependencies(
  dependencies: LocalHttpDependencies = {},
): Required<Pick<LocalHttpDependencies, "now">> & LocalHttpDependencies {
  return {
    ...dependencies,
    now: dependencies.now ?? defaultNow,
  };
}

export type LocalHttpAuth = Readonly<{
  authentication: LocalHttpAuthenticationMode;
  bearerToken?: string | null;
}>;

export function localHttpRequiresCredential(auth: LocalHttpAuth): boolean {
  return auth.authentication === "optional-local-bearer";
}

function buildAuthHeaders(auth: LocalHttpAuth): Record<string, string> {
  if (localHttpRequiresCredential(auth) && auth.bearerToken) {
    return { Authorization: `Bearer ${auth.bearerToken}` };
  }
  return {};
}

function joinEndpointPath(endpoint: string, path: string): string {
  const base = endpoint.endsWith("/") ? endpoint.slice(0, -1) : endpoint;
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

export type ResolvedLocalHttpEndpoint = ResolvedLoopbackEndpoint;

function normalizePeerAddress(address: string): string {
  return address.startsWith("::ffff:") ? address.slice(7) : address;
}

function isLoopbackPeerAddress(address: string): boolean {
  const normalized = normalizePeerAddress(address);
  const version = isIP(normalized);
  if (version === 4) return normalized.startsWith("127.");
  if (version === 6) return normalized === "::1";
  return false;
}

function selectConnectAddress(addresses: readonly string[], hostname: string): string {
  const normalizedHostname = hostname === "[::1]" ? "::1" : hostname;
  if (isIP(normalizedHostname)) {
    const exact = addresses.find((address) => normalizePeerAddress(address) === normalizedHostname);
    if (exact) return exact;
  }
  const ipv4 = addresses.find((address) => isIP(normalizePeerAddress(address)) === 4);
  if (ipv4) return ipv4;
  const ipv6 = addresses.find((address) => isIP(normalizePeerAddress(address)) === 6);
  if (ipv6) return ipv6;
  throw new Error("Validated local HTTP endpoint has no connectable addresses");
}

function fetchInputUrl(input: Parameters<LocalHttpFetch>[0]): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

function headersFromInit(init?: RequestInit): Record<string, string> {
  return Object.fromEntries(new Headers(init?.headers).entries());
}

function writeRequestBody(req: http.ClientRequest, body: RequestInit["body"]): void {
  if (body === undefined || body === null) {
    req.end();
    return;
  }
  if (typeof body === "string") {
    req.end(body);
    return;
  }
  req.end(String(body));
}

/**
 * Connects only to the validated loopback address, bypassing env/global HTTP
 * proxies and refusing a non-loopback peer after the socket is established.
 */
function createLoopbackBoundFetch(resolved: ResolvedLocalHttpEndpoint): LocalHttpFetch {
  const connectHost = selectConnectAddress(resolved.addresses, resolved.hostname);
  if (!isLoopbackPeerAddress(connectHost)) {
    throw new Error("Validated local HTTP address is not loopback");
  }

  return async (input, init) => {
    const requestUrl = new URL(fetchInputUrl(input));
    const method = init?.method ?? "GET";
    const headers = headersFromInit(init);
    if (!headers.host) {
      headers.host = `${resolved.hostname}:${resolved.port}`;
    }

    return await new Promise<Response>((resolve, reject) => {
      const req = http.request(
        {
          host: connectHost,
          port: resolved.port,
          method,
          path: `${requestUrl.pathname}${requestUrl.search}`,
          headers,
          signal: init?.signal ?? undefined,
        },
        (res) => {
          const body = new ReadableStream<Uint8Array>({
            start(controller) {
              res.on("data", (chunk: Buffer) => {
                controller.enqueue(new Uint8Array(chunk));
              });
              res.on("end", () => controller.close());
              res.on("error", (error) => controller.error(error));
            },
            cancel() {
              res.destroy();
            },
          });

          const responseHeaders = new Headers();
          for (const [name, value] of Object.entries(res.headers)) {
            if (value === undefined) continue;
            if (Array.isArray(value)) {
              for (const entry of value) responseHeaders.append(name, entry);
              continue;
            }
            responseHeaders.append(name, value);
          }

          resolve(
            new Response(body, {
              status: res.statusCode ?? 500,
              statusText: res.statusMessage,
              headers: responseHeaders,
            }),
          );
        },
      );

      req.on("socket", (socket) => {
        socket.once("connect", () => {
          const peer = socket.remoteAddress;
          if (!peer || !isLoopbackPeerAddress(peer)) {
            req.destroy(new Error("Local HTTP peer is not loopback"));
          }
        });
      });

      req.on("error", reject);
      writeRequestBody(req, init?.body ?? null);
    });
  };
}

export async function resolveLocalHttpEndpoint(
  endpoint: string,
  dependencies: LocalHttpDependencies = {},
): Promise<Result<ResolvedLocalHttpEndpoint, { code: "endpoint-forbidden"; safeMessage: string }>> {
  const resolved = await resolveLoopbackHttpEndpoint(
    { endpoint },
    { lookup: dependencies.lookup, signal: dependencies.signal },
  );
  if (!resolved.ok) {
    return err({ code: "endpoint-forbidden", safeMessage: resolved.error.safeMessage });
  }
  return ok(resolved.value);
}

export async function resolveLocalHttpTransport(
  endpoint: string,
  dependencies: LocalHttpDependencies = {},
): Promise<
  Result<
    { endpoint: string; fetcher: LocalHttpFetch; resolved: ResolvedLocalHttpEndpoint },
    { code: "endpoint-forbidden"; safeMessage: string }
  >
> {
  const resolved = await resolveLocalHttpEndpoint(endpoint, dependencies);
  if (!resolved.ok) return resolved;
  const fetcher = dependencies.fetch ?? createLoopbackBoundFetch(resolved.value);
  return ok({ endpoint: resolved.value.endpoint, fetcher, resolved: resolved.value });
}

export type LocalHttpRequestFailure = Readonly<{
  code:
    | "endpoint-unreachable"
    | "api-incompatible"
    | "oversize-response"
    | "redirect"
    | "cancelled"
    | "timed-out";
  safeMessage: string;
}>;

export type LocalHttpRequestInput = Readonly<{
  endpoint: string;
  pathname: string;
  method: "GET" | "POST";
  auth: LocalHttpAuth;
  body?: unknown;
  signal?: AbortSignal;
  /** Admitted wall-time budget for this request; aborts the in-flight body read. */
  deadlineMs?: number;
  maxResponseBytes: number;
  fetcher: LocalHttpFetch;
}>;

/**
 * One bounded local HTTP round trip: read-only path, no redirects, caller
 * cancellation composed with the admitted deadline, and a streamed response body
 * that is cancelled the moment it crosses the admitted byte cap.
 */
export async function localHttpRequest(
  input: LocalHttpRequestInput,
): Promise<Result<string, LocalHttpRequestFailure>> {
  assertReadOnlyLocalHttpPath(input.pathname);
  const url = joinEndpointPath(input.endpoint, input.pathname);

  const controller = new AbortController();
  const abortFromCaller = () => controller.abort();
  let deadlineReached = false;

  if (input.signal?.aborted) {
    controller.abort();
  } else {
    input.signal?.addEventListener("abort", abortFromCaller, { once: true });
  }

  const deadline =
    input.deadlineMs === undefined
      ? undefined
      : setTimeout(() => {
          deadlineReached = true;
          controller.abort();
        }, input.deadlineMs);
  deadline?.unref?.();

  const abortFailure = (): LocalHttpRequestFailure =>
    deadlineReached
      ? { code: "timed-out", safeMessage: "Local HTTP request exceeded the admitted wall time" }
      : { code: "cancelled", safeMessage: "Local HTTP request was cancelled" };

  try {
    const response = await input.fetcher(
      url,
      boundedFetchInit({
        method: input.method,
        headers: {
          Accept: "application/json",
          ...(input.body === undefined ? {} : { "Content-Type": "application/json" }),
          ...buildAuthHeaders(input.auth),
        },
        body: input.body === undefined ? undefined : JSON.stringify(input.body),
        signal: controller.signal,
      }),
    );

    if (response.type === "opaqueredirect" || response.redirected) {
      cancelResponseBody(response);
      return err({
        code: "redirect",
        safeMessage: "Local HTTP redirects are forbidden",
      });
    }

    if (!response.ok) {
      // A hostile loopback service can hold a rejected-status body open forever;
      // releasing it here is what closes the socket, not the cleared deadline.
      cancelResponseBody(response);
      return err({
        code: response.status === 404 ? "endpoint-unreachable" : "api-incompatible",
        safeMessage:
          response.status === 404
            ? "Local HTTP endpoint could not be reached"
            : "Local HTTP endpoint returned an incompatible response",
      });
    }

    const text = await readTextResponseWithLimit(response, input.maxResponseBytes, "Local HTTP");
    if (text.ok) {
      return ok(text.value);
    }

    if (text.error.code === "oversize-response") {
      return err({
        code: "oversize-response",
        safeMessage: "Local HTTP response exceeded the admitted byte limit",
      });
    }

    if (controller.signal.aborted) {
      return err(abortFailure());
    }

    return err({
      code: "endpoint-unreachable",
      safeMessage: "Local HTTP endpoint could not be reached",
    });
  } catch (error) {
    if (controller.signal.aborted) {
      return err(abortFailure());
    }
    if (/redirect/i.test(getErrorMessage(error))) {
      return err({ code: "redirect", safeMessage: "Local HTTP redirects are forbidden" });
    }
    return err({
      code: "endpoint-unreachable",
      safeMessage: "Local HTTP endpoint could not be reached",
    });
  } finally {
    clearTimeout(deadline);
    input.signal?.removeEventListener("abort", abortFromCaller);
  }
}
