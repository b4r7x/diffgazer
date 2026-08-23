import { err, ok, type Result } from "@diffgazer/core/result";
import {
  LOCAL_OPENAI_PRESET_ENDPOINTS,
  type LocalHttpProductId,
} from "@diffgazer/core/schemas/config";
import type { LocalReadinessObservationStatus } from "../../../config/readiness.js";
import type { DnsLookupFn } from "../endpoints.js";
import {
  discoverLocalHttpModels,
  hashLocalConformanceIdentity,
  type LocalHttpConformanceIdentity,
  probeLocalHttpConformance,
} from "./discovery.js";
import { type LocalHttpFetch, resolveLocalHttpEndpoint } from "./request.js";

const LOCAL_HTTP_LIVE_PROBE_OPT_IN_ENV = "DIFFGAZER_LIVE_PROBES" as const;

export const LOCAL_HTTP_GATE_IDS = [
  "allowed-endpoint",
  "reachability",
  "listed-exact-model",
  "schema-valid-review",
  "abort-closure",
  "redirect-fail-closed",
  "oversize-fail-closed",
] as const;

type LocalHttpGateId = (typeof LOCAL_HTTP_GATE_IDS)[number];

type LocalHttpGateStatus = "passed" | "failed" | "skipped" | "unsupported";

export type LocalHttpGateObservation = Readonly<{
  gate: LocalHttpGateId;
  status: LocalHttpGateStatus;
  detail?: string;
}>;

type LocalHttpRuntimeFixtureId = "ollama" | "lm-studio" | "llama-cpp";

export type LocalHttpRuntimeFixture = Readonly<{
  id: LocalHttpRuntimeFixtureId;
  productId: LocalHttpProductId;
  endpoint: string;
  modelId: string;
  serverVersion: string;
  runtimeIdentity: string;
}>;

export type LocalHttpConformanceSuiteResult = Readonly<{
  fixtureId: LocalHttpRuntimeFixtureId;
  source: "mock" | "live";
  gates: readonly LocalHttpGateObservation[];
  identityHash: string | null;
  expectedIdentityHash: string | null;
  ready: boolean;
  probeStatus?: LocalReadinessObservationStatus;
}>;

type LocalHttpMockRoute = Readonly<{
  method?: string;
  match: (url: string) => boolean;
  handler: (request: Request) => Response | Promise<Response>;
}>;

const SCHEMA_SHA256 = "1".repeat(64);

export const LOCAL_HTTP_RUNTIME_FIXTURES: readonly LocalHttpRuntimeFixture[] = [
  {
    id: "ollama",
    productId: "ollama",
    endpoint: "http://127.0.0.1:11434",
    modelId: "llama3.2",
    serverVersion: "0.6.0",
    runtimeIdentity: "ollama",
  },
  {
    id: "lm-studio",
    productId: "local-openai",
    endpoint: LOCAL_OPENAI_PRESET_ENDPOINTS["lm-studio"],
    modelId: "local-model",
    serverVersion: "lm-studio-0.3.8",
    runtimeIdentity: "lm-studio",
  },
  {
    id: "llama-cpp",
    productId: "local-openai",
    endpoint: LOCAL_OPENAI_PRESET_ENDPOINTS["llama-cpp"],
    modelId: "local-model",
    serverVersion: "b-version-2026-07",
    runtimeIdentity: "llama-cpp",
  },
];

export function isLocalHttpLiveProbeOptIn(): boolean {
  return process.env[LOCAL_HTTP_LIVE_PROBE_OPT_IN_ENV] === "1";
}

export function canProduceLocalReadyEvidence(result: LocalHttpConformanceSuiteResult): boolean {
  if (result.source === "mock") return false;
  return result.ready;
}

export function buildLocalConformanceIdentity(
  fixture: LocalHttpRuntimeFixture,
): LocalHttpConformanceIdentity {
  return {
    productId: fixture.productId,
    normalizedEndpoint: fixture.endpoint,
    runtime: { identity: fixture.runtimeIdentity, version: fixture.serverVersion },
    modelId: fixture.modelId,
  };
}

export function isLocalConformanceReady(
  gates: readonly LocalHttpGateObservation[],
  identityHash: string | null,
  expectedIdentityHash: string | null,
): boolean {
  if (!identityHash || !expectedIdentityHash || identityHash !== expectedIdentityHash) {
    return false;
  }
  return gates.every((gate) => gate.status === "passed");
}

function jsonResponse(body: unknown, init: ResponseInit & { redirected?: boolean } = {}): Response {
  const { redirected, ...responseInit } = init;
  const response = new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json", ...(responseInit.headers ?? {}) },
    ...responseInit,
  });
  if (redirected) {
    Object.defineProperty(response, "redirected", { value: true });
  }
  return response;
}

function fetchInputUrl(input: Parameters<LocalHttpFetch>[0]): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

function createMockLocalHttpFetch(routes: readonly LocalHttpMockRoute[]): LocalHttpFetch {
  return (async (input, init) => {
    const url = fetchInputUrl(input);
    const method = init?.method ?? "GET";
    for (const route of routes) {
      if (route.match(url) && (route.method === undefined || route.method === method)) {
        return route.handler(new Request(url, init));
      }
    }
    return new Response("not found", { status: 404 });
  }) as LocalHttpFetch;
}

function lookupLoopback(): DnsLookupFn {
  return async () => [{ address: "127.0.0.1", family: 4 }];
}

function ollamaRoutes(
  fixture: LocalHttpRuntimeFixture,
  options: {
    redirected?: boolean;
    oversizeTags?: boolean;
    schemaInvalid?: boolean;
  } = {},
): readonly LocalHttpMockRoute[] {
  return [
    {
      match: (url) => url.includes("/api/version"),
      handler: () =>
        options.redirected
          ? jsonResponse({ version: fixture.serverVersion }, { redirected: true })
          : jsonResponse({ version: fixture.serverVersion }),
    },
    {
      match: (url) => url.includes("/api/tags"),
      handler: () => {
        if (options.oversizeTags) {
          const huge = "x".repeat(2_048);
          return new Response(huge, {
            status: 200,
            headers: { "Content-Length": String(huge.length) },
          });
        }
        return jsonResponse({
          models: [{ name: fixture.modelId, details: { family: "llama" } }],
        });
      },
    },
    {
      method: "POST",
      match: (url) => url.includes("/api/chat"),
      handler: async (_request) => {
        if (options.schemaInvalid) {
          return jsonResponse({ message: { content: '{"status":"nope"}' } });
        }
        return jsonResponse({ message: { content: '{"issues":[]}' } });
      },
    },
  ];
}

function openAiRoutes(
  fixture: LocalHttpRuntimeFixture,
  options: {
    redirected?: boolean;
    oversizeModels?: boolean;
    schemaInvalid?: boolean;
  } = {},
): readonly LocalHttpMockRoute[] {
  return [
    {
      match: (url) => url.includes("/models") && !url.includes("/chat"),
      handler: () => {
        if (options.redirected) {
          return jsonResponse(
            {
              object: "list",
              server_version: fixture.serverVersion,
              data: [{ id: fixture.modelId }],
            },
            { redirected: true },
          );
        }
        if (options.oversizeModels) {
          const huge = "x".repeat(2_048);
          return new Response(huge, {
            status: 200,
            headers: { "Content-Length": String(huge.length) },
          });
        }
        return jsonResponse({
          object: "list",
          server_version: fixture.serverVersion,
          data: [{ id: fixture.modelId }],
        });
      },
    },
    {
      method: "POST",
      match: (url) => url.includes("/chat/completions"),
      handler: async () => {
        if (options.redirected) {
          return jsonResponse({ choices: [] }, { redirected: true });
        }
        if (options.schemaInvalid) {
          return jsonResponse({ choices: [{ message: { content: '{"status":"nope"}' } }] });
        }
        return jsonResponse({ choices: [{ message: { content: '{"issues":[]}' } }] });
      },
    },
  ];
}

function routeOptionsForMode(
  fixture: LocalHttpRuntimeFixture,
  mode: "positive" | "redirect" | "oversize" | "schema-invalid",
) {
  if (mode === "redirect") return { redirected: true };
  if (mode === "oversize") {
    return fixture.productId === "ollama" ? { oversizeTags: true } : { oversizeModels: true };
  }
  if (mode === "schema-invalid") return { schemaInvalid: true };
  return {};
}

function routesForFixture(
  fixture: LocalHttpRuntimeFixture,
  mode: "positive" | "redirect" | "oversize" | "schema-invalid",
): readonly LocalHttpMockRoute[] {
  const options = routeOptionsForMode(fixture, mode);
  return fixture.productId === "ollama"
    ? ollamaRoutes(fixture, options)
    : openAiRoutes(fixture, options);
}

async function observeAllowedEndpoint(
  fixture: LocalHttpRuntimeFixture,
  lookup: DnsLookupFn,
): Promise<LocalHttpGateObservation> {
  const resolved = await resolveLocalHttpEndpoint(fixture.endpoint, { lookup });
  return {
    gate: "allowed-endpoint",
    status: resolved.ok ? "passed" : "failed",
  };
}

async function observeReachability(
  fixture: LocalHttpRuntimeFixture,
  fetch: LocalHttpFetch,
  lookup: DnsLookupFn,
): Promise<LocalHttpGateObservation> {
  const discovery = await discoverLocalHttpModels(
    {
      productId: fixture.productId,
      endpoint: fixture.endpoint,
      auth: { authentication: "none" },
    },
    { fetch, lookup },
  );
  return {
    gate: "reachability",
    status: discovery.ok ? "passed" : "failed",
  };
}

async function observeListedExactModel(
  fixture: LocalHttpRuntimeFixture,
  fetch: LocalHttpFetch,
  lookup: DnsLookupFn,
): Promise<LocalHttpGateObservation> {
  const discovery = await discoverLocalHttpModels(
    {
      productId: fixture.productId,
      endpoint: fixture.endpoint,
      auth: { authentication: "none" },
    },
    { fetch, lookup },
  );
  if (!discovery.ok) {
    return { gate: "listed-exact-model", status: "failed" };
  }
  const listed = discovery.value.models.some((model) => model.modelId === fixture.modelId);
  return { gate: "listed-exact-model", status: listed ? "passed" : "failed" };
}

function createAbortAwareFetch(fixture: LocalHttpRuntimeFixture): LocalHttpFetch {
  const baseFetch = createMockLocalHttpFetch(routesForFixture(fixture, "positive"));
  return async (input, init) => {
    const url = fetchInputUrl(input);
    if ((url.includes("/api/chat") || url.includes("/chat/completions")) && init?.signal?.aborted) {
      throw new DOMException("Aborted", "AbortError");
    }
    return baseFetch(input, init);
  };
}

async function observeSchemaValidReview(
  fixture: LocalHttpRuntimeFixture,
  fetch: LocalHttpFetch,
  lookup: DnsLookupFn,
): Promise<LocalHttpGateObservation> {
  const probe = await probeLocalHttpConformance(
    {
      productId: fixture.productId,
      endpoint: fixture.endpoint,
      modelId: fixture.modelId,
      auth: { authentication: "none" },
      structuredOutputSchemaSha256: SCHEMA_SHA256,
    },
    { fetch, lookup },
  );
  if (!probe.ok) {
    return { gate: "schema-valid-review", status: "failed" };
  }
  return {
    gate: "schema-valid-review",
    status: probe.value === "passed" ? "passed" : "failed",
    detail: probe.value,
  };
}

async function observeAbortClosure(
  fixture: LocalHttpRuntimeFixture,
  lookup: DnsLookupFn,
  fetchOverride?: LocalHttpFetch,
): Promise<LocalHttpGateObservation> {
  const fetch = fetchOverride ?? createAbortAwareFetch(fixture);

  const probe = await probeLocalHttpConformance(
    {
      productId: fixture.productId,
      endpoint: fixture.endpoint,
      modelId: fixture.modelId,
      auth: { authentication: "none" },
      structuredOutputSchemaSha256: SCHEMA_SHA256,
    },
    { fetch, lookup },
  );
  if (!probe.ok) {
    return { gate: "abort-closure", status: "failed" };
  }
  return {
    gate: "abort-closure",
    status: probe.value === "passed" ? "passed" : "failed",
    detail: probe.value,
  };
}

async function observeRedirectFailClosed(
  fixture: LocalHttpRuntimeFixture,
  lookup: DnsLookupFn,
): Promise<LocalHttpGateObservation> {
  const fetch = createMockLocalHttpFetch(routesForFixture(fixture, "redirect"));
  const discovery = await discoverLocalHttpModels(
    {
      productId: fixture.productId,
      endpoint: fixture.endpoint,
      auth: { authentication: "none" },
    },
    { fetch, lookup },
  );
  return {
    gate: "redirect-fail-closed",
    status: discovery.ok ? "failed" : "passed",
  };
}

async function observeOversizeFailClosed(
  fixture: LocalHttpRuntimeFixture,
  lookup: DnsLookupFn,
): Promise<LocalHttpGateObservation> {
  const fetch = createMockLocalHttpFetch(routesForFixture(fixture, "oversize"));
  const discovery = await discoverLocalHttpModels(
    {
      productId: fixture.productId,
      endpoint: fixture.endpoint,
      auth: { authentication: "none" },
    },
    { fetch, lookup },
  );
  return {
    gate: "oversize-fail-closed",
    status: discovery.ok ? "failed" : "passed",
  };
}

export async function runLocalHttpMockGateSuite(
  fixture: LocalHttpRuntimeFixture,
): Promise<LocalHttpConformanceSuiteResult> {
  const lookup = lookupLoopback();
  const positiveFetch = createAbortAwareFetch(fixture);

  const gates: LocalHttpGateObservation[] = [
    await observeAllowedEndpoint(fixture, lookup),
    await observeReachability(fixture, positiveFetch, lookup),
    await observeListedExactModel(fixture, positiveFetch, lookup),
    await observeSchemaValidReview(fixture, positiveFetch, lookup),
    await observeAbortClosure(fixture, lookup),
    await observeRedirectFailClosed(fixture, lookup),
    await observeOversizeFailClosed(fixture, lookup),
  ];

  const discovery = await discoverLocalHttpModels(
    {
      productId: fixture.productId,
      endpoint: fixture.endpoint,
      auth: { authentication: "none" },
    },
    { fetch: positiveFetch, lookup },
  );

  const identity =
    discovery.ok && discovery.value.models.some((model) => model.modelId === fixture.modelId)
      ? buildLocalConformanceIdentity({
          ...fixture,
          serverVersion: discovery.value.runtime.version,
          runtimeIdentity: discovery.value.runtime.identity,
        })
      : null;

  const identityHash = identity ? hashLocalConformanceIdentity(identity) : null;
  const expectedIdentityHash = hashLocalConformanceIdentity(buildLocalConformanceIdentity(fixture));
  const ready = isLocalConformanceReady(gates, identityHash, expectedIdentityHash);

  return {
    fixtureId: fixture.id,
    source: "mock",
    gates,
    identityHash,
    expectedIdentityHash,
    ready,
    probeStatus: ready ? "passed" : undefined,
  };
}

export async function isLocalRuntimeReachable(fixture: LocalHttpRuntimeFixture): Promise<boolean> {
  const lookup = lookupLoopback();
  const discovery = await discoverLocalHttpModels(
    {
      productId: fixture.productId,
      endpoint: fixture.endpoint,
      auth: { authentication: "none" },
    },
    { fetch: globalThis.fetch, lookup },
  );
  return discovery.ok;
}

export async function runLocalHttpLiveGateSuite(
  fixture: LocalHttpRuntimeFixture,
): Promise<LocalHttpConformanceSuiteResult> {
  if (!isLocalHttpLiveProbeOptIn()) {
    return {
      fixtureId: fixture.id,
      source: "live",
      gates: LOCAL_HTTP_GATE_IDS.map((gate) => ({
        gate,
        status: "skipped",
        detail: "live-probes-disabled",
      })),
      identityHash: null,
      expectedIdentityHash: null,
      ready: false,
    };
  }

  const reachable = await isLocalRuntimeReachable(fixture);
  if (!reachable) {
    return {
      fixtureId: fixture.id,
      source: "live",
      gates: LOCAL_HTTP_GATE_IDS.map((gate) => ({
        gate,
        status: "unsupported",
        detail: "local-runtime-unavailable",
      })),
      identityHash: null,
      expectedIdentityHash: null,
      ready: false,
    };
  }

  const lookup = lookupLoopback();
  const fetch = globalThis.fetch;
  const gates: LocalHttpGateObservation[] = [
    await observeAllowedEndpoint(fixture, lookup),
    await observeReachability(fixture, fetch, lookup),
    await observeListedExactModel(fixture, fetch, lookup),
    await observeSchemaValidReview(fixture, fetch, lookup),
    await observeAbortClosure(fixture, lookup, fetch),
    await observeRedirectFailClosed(fixture, lookup),
    await observeOversizeFailClosed(fixture, lookup),
  ];

  const discovery = await discoverLocalHttpModels(
    {
      productId: fixture.productId,
      endpoint: fixture.endpoint,
      auth: { authentication: "none" },
    },
    { fetch, lookup },
  );

  if (!discovery.ok) {
    return {
      fixtureId: fixture.id,
      source: "live",
      gates,
      identityHash: null,
      expectedIdentityHash: null,
      ready: false,
    };
  }

  const selectedModel =
    discovery.value.models.find((model) => model.modelId === fixture.modelId)?.modelId ??
    discovery.value.models[0]?.modelId;
  if (!selectedModel) {
    return {
      fixtureId: fixture.id,
      source: "live",
      gates,
      identityHash: null,
      expectedIdentityHash: null,
      ready: false,
    };
  }

  const identity = buildLocalConformanceIdentity({
    ...fixture,
    modelId: selectedModel,
    serverVersion: discovery.value.runtime.version,
    runtimeIdentity: discovery.value.runtime.identity,
  });
  const identityHash = hashLocalConformanceIdentity(identity);
  const expectedIdentityHash = hashLocalConformanceIdentity(buildLocalConformanceIdentity(fixture));
  const ready = isLocalConformanceReady(gates, identityHash, expectedIdentityHash);

  const probe = await probeLocalHttpConformance(
    {
      productId: fixture.productId,
      endpoint: fixture.endpoint,
      modelId: selectedModel,
      auth: { authentication: "none" },
      structuredOutputSchemaSha256: SCHEMA_SHA256,
    },
    { fetch, lookup },
  );

  return {
    fixtureId: fixture.id,
    source: "live",
    gates,
    identityHash,
    expectedIdentityHash,
    ready,
    probeStatus: probe.ok ? probe.value : undefined,
  };
}

export function assertAllGateObservationsPresent(
  gates: readonly LocalHttpGateObservation[],
): Result<true, string> {
  for (const gateId of LOCAL_HTTP_GATE_IDS) {
    if (!gates.some((gate) => gate.gate === gateId)) {
      return err(`missing gate observation: ${gateId}`);
    }
  }
  return ok(true);
}
