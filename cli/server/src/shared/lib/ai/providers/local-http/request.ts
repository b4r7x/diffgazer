import { getErrorMessage } from "@diffgazer/core/errors";
import { err, ok, type Result } from "@diffgazer/core/result";
import type { LocalHttpAuthenticationMode } from "@diffgazer/core/schemas/config";
import { readTextResponseWithLimit } from "../../http-json.js";
import type { AdapterExecuteRequest } from "../../types.js";
import { boundedFetchInit, type DnsLookupFn, resolveLoopbackHttpEndpoint } from "../endpoints.js";

/** Paths that must never be called for local HTTP transports (REQ-032). */
export const LOCAL_HTTP_FORBIDDEN_PATH_PREFIXES = [
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
  now?: () => Date;
  resolveBearerToken?: (request: AdapterExecuteRequest) => Promise<string | null>;
}>;

function defaultNow(): Date {
  return new Date();
}

export function resolveLocalHttpDependencies(
  dependencies: LocalHttpDependencies = {},
): Required<Pick<LocalHttpDependencies, "fetch" | "now">> & LocalHttpDependencies {
  return {
    fetch: dependencies.fetch ?? globalThis.fetch,
    lookup: dependencies.lookup,
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
  if (auth.authentication === "optional-local-bearer" && auth.bearerToken) {
    return { Authorization: `Bearer ${auth.bearerToken}` };
  }
  return {};
}

function joinEndpointPath(endpoint: string, path: string): string {
  const base = endpoint.endsWith("/") ? endpoint.slice(0, -1) : endpoint;
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

/** Loopback-validated endpoint; the only endpoint a local transport may call. */
export async function resolveLocalHttpEndpoint(
  endpoint: string,
  dependencies: LocalHttpDependencies = {},
): Promise<Result<{ endpoint: string }, { code: "endpoint-forbidden"; safeMessage: string }>> {
  const resolved = await resolveLoopbackHttpEndpoint({ endpoint }, { lookup: dependencies.lookup });
  if (!resolved.ok) {
    return err({ code: "endpoint-forbidden", safeMessage: resolved.error.safeMessage });
  }
  return ok({ endpoint: resolved.value.endpoint });
}

export type LocalHttpRequestFailure = Readonly<{
  code:
    | "endpoint-unreachable"
    | "api-incompatible"
    | "oversize-response"
    | "redirect"
    | "cancelled";
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
): Promise<Result<string, LocalHttpRequestFailure | { code: "timed-out"; safeMessage: string }>> {
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

  const abortFailure = (): LocalHttpRequestFailure | { code: "timed-out"; safeMessage: string } =>
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
      return err({
        code: "redirect",
        safeMessage: "Local HTTP redirects are forbidden",
      });
    }

    if (!response.ok) {
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
