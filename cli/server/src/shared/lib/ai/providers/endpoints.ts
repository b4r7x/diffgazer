import dns from "node:dns/promises";
import { isIP } from "node:net";
import { PRODUCT_REGISTRY } from "@diffgazer/core/providers";
import { err, ok, type Result } from "@diffgazer/core/result";
import {
  getHostedApiEndpointTuple,
  HOSTED_API_PRODUCT_IDS,
  HostedApiEndpointSchema,
  type HostedApiProductId,
  LOCAL_OPENAI_PRESET_ENDPOINTS,
  LoopbackHttpEndpointSchema,
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
  | "lookalike-endpoint"
  | "invalid-loopback-endpoint"
  | "non-loopback-resolution"
  | "mixed-address-family"
  | "dns-resolution-failed";

export type EndpointFailure = Readonly<{
  code: EndpointFailureCode;
  safeMessage: string;
}>;

export type ResolvedHostedEndpoint = Readonly<{
  endpoint: string;
  productId: HostedApiProductId;
}>;

export type ResolvedLoopbackEndpoint = Readonly<{
  endpoint: string;
  hostname: string;
  port: number;
  pathname: string;
  addresses: readonly string[];
}>;

type DnsLookupAddress = Readonly<{
  address: string;
  family: number;
}>;

export type DnsLookupFn = (hostname: string) => Promise<readonly DnsLookupAddress[]>;

const DEFAULT_DNS_LOOKUP: DnsLookupFn = (hostname) =>
  dns.lookup(hostname, { all: true, verbatim: true });

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

function isLoopbackAddress(address: string): boolean {
  const version = isIP(address);
  if (version === 4) {
    return address.startsWith("127.");
  }
  if (version === 6) {
    return address === "::1";
  }
  return false;
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

function normalizeLoopbackPathname(pathname: string): string {
  return pathname === "/" ? "" : pathname;
}

function addressFamily(address: string): "ipv4" | "ipv6" | null {
  const version = isIP(address);
  if (version === 4) return "ipv4";
  if (version === 6) return "ipv6";
  return null;
}

export type ResolveLoopbackEndpointInput = Readonly<{
  endpoint: string;
}>;

export async function resolveLoopbackHttpEndpoint(
  input: ResolveLoopbackEndpointInput,
  options: Readonly<{ lookup?: DnsLookupFn; signal?: AbortSignal }> = {},
): Promise<Result<ResolvedLoopbackEndpoint, EndpointFailure>> {
  if (options.signal?.aborted) {
    return err(
      endpointFailure("dns-resolution-failed", "Local endpoint hostname could not be resolved"),
    );
  }

  const schemaResult = LoopbackHttpEndpointSchema.safeParse(input.endpoint);
  if (!schemaResult.success) {
    return err(
      endpointFailure(
        "invalid-loopback-endpoint",
        "Local endpoint must be a normalized loopback URL",
      ),
    );
  }

  const endpoint = schemaResult.data;
  const parsed = parseUrl(endpoint);
  if (!parsed) {
    return err(
      endpointFailure(
        "invalid-loopback-endpoint",
        "Local endpoint must be a normalized loopback URL",
      ),
    );
  }

  if (isIP(parsed.hostname) && !isLoopbackAddress(parsed.hostname)) {
    return err(
      endpointFailure("non-loopback-resolution", "Local endpoint must resolve only to loopback"),
    );
  }

  const lookup = options.lookup ?? DEFAULT_DNS_LOOKUP;
  let records: readonly DnsLookupAddress[];

  try {
    records = await lookup(parsed.hostname);
  } catch {
    return err(
      endpointFailure("dns-resolution-failed", "Local endpoint hostname could not be resolved"),
    );
  }

  if (options.signal?.aborted) {
    return err(
      endpointFailure("dns-resolution-failed", "Local endpoint hostname could not be resolved"),
    );
  }

  if (records.length === 0) {
    return err(
      endpointFailure("dns-resolution-failed", "Local endpoint hostname could not be resolved"),
    );
  }

  const addresses = records.map((record) => record.address);
  const loopbackFamilies = new Set<"ipv4" | "ipv6">();
  const nonLoopbackFamilies = new Set<"ipv4" | "ipv6">();

  for (const address of addresses) {
    const family = addressFamily(address);
    if (!family) {
      return err(
        endpointFailure(
          "non-loopback-resolution",
          "Local endpoint resolved to a non-loopback address",
        ),
      );
    }
    if (isLoopbackAddress(address)) {
      loopbackFamilies.add(family);
      continue;
    }
    nonLoopbackFamilies.add(family);
  }

  if (nonLoopbackFamilies.size > 0) {
    if (loopbackFamilies.size > 0) {
      return err(
        endpointFailure(
          "mixed-address-family",
          "Local endpoint resolved to mixed loopback and non-loopback addresses",
        ),
      );
    }
    return err(
      endpointFailure(
        "non-loopback-resolution",
        "Local endpoint resolved to a non-loopback address",
      ),
    );
  }

  return ok({
    endpoint,
    hostname: parsed.hostname,
    port: parsed.port ? Number(parsed.port) : 80,
    pathname: normalizeLoopbackPathname(parsed.pathname),
    addresses,
  });
}

export function isExactLocalOpenAIPreset(
  endpoint: string,
  presetId: keyof typeof LOCAL_OPENAI_PRESET_ENDPOINTS,
): boolean {
  return endpoint === LOCAL_OPENAI_PRESET_ENDPOINTS[presetId];
}
