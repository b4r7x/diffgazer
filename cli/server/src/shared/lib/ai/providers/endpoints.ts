import { PRODUCT_REGISTRY } from "@diffgazer/core/providers";
import { err, ok, type Result } from "@diffgazer/core/result";
import {
  getHostedApiEndpointTuple,
  HOSTED_API_PRODUCT_IDS,
  HostedApiEndpointSchema,
  type HostedApiProductId,
} from "@diffgazer/core/schemas/config";

export const DISABLE_REDIRECTS = "error" as const;

type EndpointFailureCode =
  | "invalid-hosted-endpoint"
  | "http-hosted-forbidden"
  | "user-info-forbidden"
  | "query-forbidden"
  | "fragment-forbidden"
  | "unexpected-port"
  | "unexpected-path"
  | "tuple-mismatch"
  | "lookalike-endpoint";

export type EndpointFailure = Readonly<{
  code: EndpointFailureCode;
  safeMessage: string;
}>;

export type ResolvedHostedEndpoint = Readonly<{
  endpoint: string;
  productId: HostedApiProductId;
}>;

function endpointFailure(code: EndpointFailureCode, safeMessage: string): EndpointFailure {
  return { code, safeMessage };
}

function parseUrl(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function classifyHostedEndpointFailure(endpoint: string): EndpointFailure {
  const parsed = parseUrl(endpoint);
  if (!parsed) {
    return endpointFailure("invalid-hosted-endpoint", "Hosted endpoint URL is invalid");
  }
  if (parsed.protocol === "http:") {
    return endpointFailure("http-hosted-forbidden", "Hosted endpoints must use HTTPS");
  }
  if (parsed.username || parsed.password) {
    return endpointFailure("user-info-forbidden", "Endpoint must not contain user info");
  }
  if (parsed.search) {
    return endpointFailure("query-forbidden", "Endpoint must not contain a query");
  }
  if (parsed.hash) {
    return endpointFailure("fragment-forbidden", "Endpoint must not contain a fragment");
  }
  if (parsed.port) {
    return endpointFailure("unexpected-port", "Hosted endpoints must use the default HTTPS port");
  }
  const pathname = parsed.pathname === "/" ? "" : parsed.pathname;
  if (endpoint !== `${parsed.origin}${pathname}`) {
    return endpointFailure("unexpected-path", "Endpoint must be normalized");
  }
  return endpointFailure("invalid-hosted-endpoint", "Hosted endpoint URL is invalid");
}

function isLookalikeHostedEndpoint(productId: HostedApiProductId, endpoint: string): boolean {
  const parsed = parseUrl(endpoint);
  if (!parsed) return false;
  const host = parsed.hostname.toLowerCase();

  for (const otherProductId of HOSTED_API_PRODUCT_IDS) {
    for (const profile of PRODUCT_REGISTRY[otherProductId].configuration.endpoints) {
      const official = parseUrl(profile.endpoint);
      if (!official) continue;
      const officialHost = official.hostname.toLowerCase();
      if (host === officialHost) continue;
      if (host.endsWith(`.${officialHost}`) || host.includes(officialHost)) {
        return true;
      }
    }
  }

  for (const profile of PRODUCT_REGISTRY[productId].configuration.endpoints) {
    const official = parseUrl(profile.endpoint);
    if (!official) continue;
    const officialHost = official.hostname.toLowerCase();
    if (host !== officialHost && host.includes(officialHost)) {
      return true;
    }
  }

  return false;
}

export type ResolveHostedEndpointInput = Readonly<{
  productId: HostedApiProductId;
  endpoint: string;
}>;

export function resolveHostedApiEndpoint(
  input: ResolveHostedEndpointInput,
): Result<ResolvedHostedEndpoint, EndpointFailure> {
  const schemaResult = HostedApiEndpointSchema.safeParse(input.endpoint);
  if (!schemaResult.success) {
    return err(classifyHostedEndpointFailure(input.endpoint));
  }

  const endpoint = schemaResult.data;

  if (isLookalikeHostedEndpoint(input.productId, endpoint)) {
    return err(
      endpointFailure("lookalike-endpoint", "Endpoint hostname is not the exact product origin"),
    );
  }

  if (!getHostedApiEndpointTuple(input.productId, endpoint)) {
    return err(endpointFailure("tuple-mismatch", "Endpoint does not match the selected product"));
  }

  return ok({ endpoint, productId: input.productId });
}

export function boundedFetchInit(init: RequestInit = {}): RequestInit {
  return { ...init, redirect: DISABLE_REDIRECTS };
}
