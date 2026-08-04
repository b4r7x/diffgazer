import { LOCAL_OPENAI_PRESET_ENDPOINTS } from "@diffgazer/core/schemas/config";
import type { EvidenceKey } from "@diffgazer/core/schemas/review";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { DnsLookupFn } from "../endpoints.js";
import {
  discoverLocalHttpModels,
  getLocalHttpPrivacyNotice,
  hashLocalConformanceIdentity,
  isOllamaCloudModel,
  mapDiscoveryFailureToObservation,
  mapSelectedModelMissing,
  probeLocalHttpConformance,
} from "./discovery.js";
import {
  assertReadOnlyLocalHttpPath,
  isForbiddenLocalHttpPath,
  type LocalHttpFetch,
  localHttpRequiresCredential,
  resolveLocalHttpEndpoint,
} from "./request.js";
import { createLocalHttpAdapter, localOpenaiAdapter, ollamaAdapter } from "./transport.js";

const OLLAMA_ENDPOINT = "http://127.0.0.1:11434";
const LM_STUDIO_ENDPOINT = LOCAL_OPENAI_PRESET_ENDPOINTS["lm-studio"];
const LLAMA_CPP_ENDPOINT = LOCAL_OPENAI_PRESET_ENDPOINTS["llama-cpp"];

const LIMITS = {
  maxInputTokens: 20_000,
  maxOutputTokens: 4_000,
  maxResponseBytes: 1_048_576,
  wallTimeMs: 120_000,
  maxRetries: 2,
  maxConcurrency: 1,
  maxCostUsd: 0.5,
} as const;

const SCHEMA_SHA256 = "1".repeat(64);

function lookupLoopback(): DnsLookupFn {
  return async () => [{ address: "127.0.0.1", family: 4 }];
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

type MockRoute = {
  method?: string;
  match: (url: string) => boolean;
  handler: (request: Request) => Response | Promise<Response>;
};

type FetchInput = Parameters<LocalHttpFetch>[0];

function fetchInputUrl(input: FetchInput): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

function createMockFetch(routes: readonly MockRoute[], calls: string[] = []) {
  return vi.fn(async (input: FetchInput, init?: RequestInit) => {
    const url = fetchInputUrl(input);
    const method = init?.method ?? "GET";
    calls.push(`${method} ${url}`);
    for (const route of routes) {
      if (route.match(url) && (route.method === undefined || route.method === method)) {
        return route.handler(new Request(url, init));
      }
    }
    return new Response("not found", { status: 404 });
  });
}

function ollamaRoutes(
  options: {
    models?: Array<Record<string, unknown>>;
    version?: string;
    chatBody?: (request: Request) => unknown;
    onChat?: () => void;
  } = {},
): readonly MockRoute[] {
  return [
    {
      match: (url) => url.includes("/api/version"),
      handler: () => jsonResponse({ version: options.version ?? "0.6.0" }),
    },
    {
      match: (url) => url.includes("/api/tags"),
      handler: () =>
        jsonResponse({
          models: options.models ?? [{ name: "llama3.2", details: { family: "llama" } }],
        }),
    },
    {
      method: "POST",
      match: (url) => url.includes("/api/chat"),
      handler: async (request) => {
        options.onChat?.();
        const payload = options.chatBody
          ? options.chatBody(request)
          : { message: { content: '{"status":"ok"}' } };
        return jsonResponse(payload);
      },
    },
  ];
}

function openAiRoutes(
  options: {
    models?: Array<{ id: string }>;
    serverVersion?: string;
    chatBody?: (request: Request) => unknown;
    onChat?: () => void;
  } = {},
): readonly MockRoute[] {
  return [
    {
      match: (url) => url.includes("/models") && !url.includes("/chat"),
      handler: () =>
        jsonResponse({
          object: "list",
          server_version: options.serverVersion ?? "b-version-2026-07",
          data: options.models ?? [{ id: "local-model" }],
        }),
    },
    {
      method: "POST",
      match: (url) => url.includes("/chat/completions"),
      handler: async (request) => {
        options.onChat?.();
        const payload = options.chatBody
          ? options.chatBody(request)
          : { choices: [{ message: { content: '{"status":"ok"}' } }] };
        return jsonResponse(payload);
      },
    },
  ];
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("REQ-033 local readiness states", () => {
  it("maps endpoint-unreachable discovery failure to endpoint-unreachable observation", async () => {
    const fetch = createMockFetch([]);
    const result = await discoverLocalHttpModels(
      {
        productId: "ollama",
        endpoint: OLLAMA_ENDPOINT,
        auth: { authentication: "none" },
      },
      { fetch, lookup: lookupLoopback() },
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(mapDiscoveryFailureToObservation(result.error)).toBe("endpoint-unreachable");
  });

  it("maps forbidden loopback resolution to endpoint-forbidden observation", async () => {
    const result = await discoverLocalHttpModels(
      {
        productId: "ollama",
        endpoint: "http://192.168.1.10:11434",
        auth: { authentication: "none" },
      },
      { fetch: createMockFetch([]), lookup: lookupLoopback() },
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(mapDiscoveryFailureToObservation(result.error)).toBe("endpoint-forbidden");
  });

  it("maps incompatible API responses to api-incompatible observation", async () => {
    const fetch = createMockFetch([
      {
        match: (url) => url.endsWith("/api/version"),
        handler: () => jsonResponse({ version: "0.6.0" }),
      },
      {
        match: (url) => url.endsWith("/api/tags"),
        handler: () => new Response("not-json", { status: 200 }),
      },
    ]);
    const result = await discoverLocalHttpModels(
      { productId: "ollama", endpoint: OLLAMA_ENDPOINT, auth: { authentication: "none" } },
      { fetch, lookup: lookupLoopback() },
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(mapDiscoveryFailureToObservation(result.error)).toBe("api-incompatible");
  });

  it("maps empty review-capable model lists to no-review-capable-model observation", async () => {
    const fetch = createMockFetch(
      ollamaRoutes({ models: [{ name: "bad alias/latest", details: {} }] }),
    );
    const result = await discoverLocalHttpModels(
      { productId: "ollama", endpoint: OLLAMA_ENDPOINT, auth: { authentication: "none" } },
      { fetch, lookup: lookupLoopback() },
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(mapDiscoveryFailureToObservation(result.error)).toBe("no-review-capable-model");
  });

  it("maps a missing selected model to selected-model-missing observation", async () => {
    const fetch = createMockFetch(ollamaRoutes());
    const discovery = await discoverLocalHttpModels(
      { productId: "ollama", endpoint: OLLAMA_ENDPOINT, auth: { authentication: "none" } },
      { fetch, lookup: lookupLoopback() },
    );
    expect(discovery.ok).toBe(true);
    if (!discovery.ok) return;
    expect(mapSelectedModelMissing("missing-model", discovery.value.models)).toBe(
      "selected-model-missing",
    );

    const probe = await probeLocalHttpConformance(
      {
        productId: "ollama",
        endpoint: OLLAMA_ENDPOINT,
        modelId: "missing-model",
        auth: { authentication: "none" },
        structuredOutputSchemaSha256: SCHEMA_SHA256,
      },
      { fetch, lookup: lookupLoopback() },
    );
    expect(probe.ok).toBe(true);
    if (!probe.ok) return;
    expect(probe.value).toBe("selected-model-missing");
  });

  it("maps schema probe failure to conformance-failed observation", async () => {
    const fetch = createMockFetch(
      ollamaRoutes({
        chatBody: () => ({ message: { content: '{"status":"nope"}' } }),
      }),
    );
    const probe = await probeLocalHttpConformance(
      {
        productId: "ollama",
        endpoint: OLLAMA_ENDPOINT,
        modelId: "llama3.2",
        auth: { authentication: "none" },
        structuredOutputSchemaSha256: SCHEMA_SHA256,
      },
      { fetch, lookup: lookupLoopback() },
    );
    expect(probe.ok).toBe(true);
    if (!probe.ok) return;
    expect(probe.value).toBe("conformance-failed");
  });

  it("maps abort probe failure to cancellation-failed observation", async () => {
    const fetch = vi.fn(async (input: FetchInput, init?: RequestInit) => {
      const url = fetchInputUrl(input);
      if (url.includes("/api/chat")) {
        if (init?.signal?.aborted) {
          return jsonResponse({ message: { content: '{"status":"ok"}' } });
        }
        return jsonResponse({ message: { content: '{"status":"ok"}' } });
      }
      if (url.includes("/api/version")) {
        return jsonResponse({ version: "0.6.0" });
      }
      if (url.includes("/api/tags")) {
        return jsonResponse({ models: [{ name: "llama3.2" }] });
      }
      return new Response("not found", { status: 404 });
    });

    const probe = await probeLocalHttpConformance(
      {
        productId: "ollama",
        endpoint: OLLAMA_ENDPOINT,
        modelId: "llama3.2",
        auth: { authentication: "none" },
        structuredOutputSchemaSha256: SCHEMA_SHA256,
      },
      { fetch, lookup: lookupLoopback() },
    );
    expect(probe.ok).toBe(true);
    if (!probe.ok) return;
    expect(probe.value).toBe("cancellation-failed");
  });

  it("returns passed when discovery, schema probe, and abort probe succeed", async () => {
    const baseFetch = createMockFetch(ollamaRoutes());
    const fetch = vi.fn(async (input: FetchInput, init?: RequestInit) => {
      const url = fetchInputUrl(input);
      if (url.includes("/api/chat") && init?.signal?.aborted) {
        throw new DOMException("Aborted", "AbortError");
      }
      return baseFetch(input, init);
    });
    const probe = await probeLocalHttpConformance(
      {
        productId: "ollama",
        endpoint: OLLAMA_ENDPOINT,
        modelId: "llama3.2",
        auth: { authentication: "none" },
        structuredOutputSchemaSha256: SCHEMA_SHA256,
      },
      { fetch, lookup: lookupLoopback() },
    );
    expect(probe.ok).toBe(true);
    if (!probe.ok) return;
    expect(probe.value).toBe("passed");
  });
});

describe("endpoint resolution", () => {
  it("accepts exact local-openai presets and normalized loopback variations", async () => {
    const lookup = lookupLoopback();
    const lmStudio = await resolveLocalHttpEndpoint(LM_STUDIO_ENDPOINT, { lookup });
    expect(lmStudio.ok).toBe(true);
    if (!lmStudio.ok) return;
    expect(lmStudio.value.endpoint).toBe(LM_STUDIO_ENDPOINT);

    const localhostOllama = await resolveLocalHttpEndpoint("http://localhost:11434", { lookup });
    expect(localhostOllama.ok).toBe(true);
    if (!localhostOllama.ok) return;
    expect(localhostOllama.value.endpoint).toBe("http://localhost:11434");
  });

  it("rejects non-loopback endpoints before discovery", async () => {
    const result = await resolveLocalHttpEndpoint("http://10.0.0.5:11434", {
      lookup: lookupLoopback(),
    });
    expect(result.ok).toBe(false);
  });
});

describe("no fake key", () => {
  it("does not require a hosted API key for local discovery with authentication none", async () => {
    expect(localHttpRequiresCredential({ authentication: "none" })).toBe(false);
    const fetch = createMockFetch(ollamaRoutes());
    const result = await discoverLocalHttpModels(
      { productId: "ollama", endpoint: OLLAMA_ENDPOINT, auth: { authentication: "none" } },
      { fetch, lookup: lookupLoopback() },
    );
    expect(result.ok).toBe(true);
  });

  it("accepts optional bearer auth without treating it as a hosted API key", async () => {
    const calls: string[] = [];
    const fetch = createMockFetch(ollamaRoutes(), calls);
    const result = await discoverLocalHttpModels(
      {
        productId: "ollama",
        endpoint: OLLAMA_ENDPOINT,
        auth: { authentication: "optional-local-bearer", bearerToken: "local-bearer-token" },
      },
      { fetch, lookup: lookupLoopback() },
    );
    expect(result.ok).toBe(true);
    expect(calls.some((entry) => entry.includes("/api/tags"))).toBe(true);
  });
});

describe("Ollama Cloud exclusion", () => {
  it("excludes remote Ollama Cloud models from discovery", () => {
    expect(isOllamaCloudModel({ name: "gpt-oss:120b", remote_model: "gpt-oss:120b" })).toBe(true);
    expect(isOllamaCloudModel({ name: "llama3.2", details: { family: "llama" } })).toBe(false);
  });

  it("never lists Ollama Cloud models as review-capable", async () => {
    const fetch = createMockFetch(
      ollamaRoutes({
        models: [
          { name: "gpt-oss:120b", remote_model: "gpt-oss:120b" },
          { name: "llama3.2", details: { family: "llama" } },
        ],
      }),
    );
    const result = await discoverLocalHttpModels(
      { productId: "ollama", endpoint: OLLAMA_ENDPOINT, auth: { authentication: "none" } },
      { fetch, lookup: lookupLoopback() },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.models.map((model) => model.modelId)).toEqual(["llama3.2"]);
  });
});

describe("no model lifecycle call", () => {
  it("rejects forbidden model lifecycle paths before any fetch", () => {
    expect(isForbiddenLocalHttpPath("/api/pull")).toBe(true);
    expect(isForbiddenLocalHttpPath("/api/delete")).toBe(true);
    expect(() => assertReadOnlyLocalHttpPath("/api/pull")).toThrow(/Forbidden local HTTP path/);
  });

  it("records only read-only discovery and generation calls for Ollama", async () => {
    const calls: string[] = [];
    const fetch = createMockFetch(ollamaRoutes(), calls);
    await discoverLocalHttpModels(
      { productId: "ollama", endpoint: OLLAMA_ENDPOINT, auth: { authentication: "none" } },
      { fetch, lookup: lookupLoopback() },
    );
    expect(calls).toEqual(
      expect.arrayContaining([
        "GET http://127.0.0.1:11434/api/version",
        "GET http://127.0.0.1:11434/api/tags",
      ]),
    );
    expect(calls.some((entry) => entry.includes("/api/pull"))).toBe(false);
    expect(calls.some((entry) => entry.includes("/api/delete"))).toBe(false);
  });
});

describe("exact selected-model and server-version invalidation", () => {
  it("changes the conformance identity hash when endpoint, model, or server version changes", () => {
    const base = {
      productId: "ollama" as const,
      normalizedEndpoint: OLLAMA_ENDPOINT,
      runtime: { identity: "ollama", version: "0.6.0" },
      modelId: "llama3.2",
    };
    const original = hashLocalConformanceIdentity(base);
    expect(hashLocalConformanceIdentity({ ...base, modelId: "mistral" })).not.toBe(original);
    expect(
      hashLocalConformanceIdentity({
        ...base,
        runtime: { identity: "ollama", version: "0.6.1" },
      }),
    ).not.toBe(original);
    expect(
      hashLocalConformanceIdentity({
        ...base,
        normalizedEndpoint: "http://127.0.0.1:11435",
      }),
    ).not.toBe(original);
  });

  it("fails adapter execution when the probed server version no longer matches evidence", async () => {
    const fetch = createMockFetch(ollamaRoutes({ version: "0.6.1" }));
    const adapter = createLocalHttpAdapter("ollama", { fetch, lookup: lookupLoopback() });
    const evidenceKey = {
      authentication: "none",
      credentialReferenceIdentity: null,
      installationId: null,
      productId: "ollama",
      transportFamily: "local-http",
      normalizedEndpoint: OLLAMA_ENDPOINT,
      region: null,
      workspaceAccountReference: null,
      modelId: "llama3.2",
      runtime: { identity: "ollama", version: "0.6.0" },
      structuredOutputSchemaSha256: SCHEMA_SHA256,
      noticeVersion: 1,
      limits: LIMITS,
    } satisfies EvidenceKey;

    const result = await adapter.execute({
      configurationId: "cfg-1",
      configurationRevision: 1,
      evidenceKey,
      prompt: '{"issues":[]}',
    });
    expect(result.receipt.outcome).toBe("transport-failed");
    expect(result.result.issues).toEqual([]);
  });
});

describe("redirect oversize and cancel failures", () => {
  it("fails closed on redirects during discovery", async () => {
    const fetch = vi.fn(async () =>
      jsonResponse({ version: "0.6.0" }, { status: 200, redirected: true }),
    );
    const result = await discoverLocalHttpModels(
      { productId: "ollama", endpoint: OLLAMA_ENDPOINT, auth: { authentication: "none" } },
      { fetch, lookup: lookupLoopback() },
    );
    expect(result.ok).toBe(false);
  });

  it("fails closed on oversized responses", async () => {
    const huge = "x".repeat(2_048);
    const fetch = createMockFetch([
      {
        match: (url) => url.endsWith("/api/version"),
        handler: () => jsonResponse({ version: "0.6.0" }),
      },
      {
        match: (url) => url.endsWith("/api/tags"),
        handler: () =>
          new Response(huge, {
            status: 200,
            headers: { "Content-Length": String(huge.length) },
          }),
      },
    ]);
    const result = await discoverLocalHttpModels(
      { productId: "ollama", endpoint: OLLAMA_ENDPOINT, auth: { authentication: "none" } },
      { fetch, lookup: lookupLoopback() },
    );
    expect(result.ok).toBe(false);
  });

  it("returns cancelled for adapter execution when the request aborts", async () => {
    const controller = new AbortController();
    controller.abort();
    const adapter = createLocalHttpAdapter("ollama", {
      fetch: createMockFetch(ollamaRoutes()),
      lookup: lookupLoopback(),
    });
    const evidenceKey = {
      authentication: "none",
      credentialReferenceIdentity: null,
      installationId: null,
      productId: "ollama",
      transportFamily: "local-http",
      normalizedEndpoint: OLLAMA_ENDPOINT,
      region: null,
      workspaceAccountReference: null,
      modelId: "llama3.2",
      runtime: { identity: "ollama", version: "0.6.0" },
      structuredOutputSchemaSha256: SCHEMA_SHA256,
      noticeVersion: 1,
      limits: LIMITS,
    } satisfies EvidenceKey;

    const result = await adapter.execute({
      configurationId: "cfg-1",
      configurationRevision: 1,
      evidenceKey,
      prompt: '{"issues":[]}',
      signal: controller.signal,
    });
    expect(result.receipt.outcome).toBe("cancelled");
    expect(result.result.issues).toEqual([]);
  });
});

describe("truthful local notice", () => {
  it("states loopback-only first-hop verification without zero-cost or privacy guarantees", () => {
    const notice = getLocalHttpPrivacyNotice("ollama");
    expect(notice.join(" ")).toMatch(/loopback/i);
    expect(notice.join(" ")).not.toMatch(
      /zero[- ]cost|unlimited|adequate hardware|zero retention/i,
    );
    expect(notice.join(" ")).toMatch(/Ollama Cloud is not this transport/);
  });
});

describe("local-openai discovery and adapter export", () => {
  it("discovers models from the OpenAI-compatible /v1/models contract", async () => {
    const fetch = createMockFetch(openAiRoutes({ serverVersion: "lm-studio-0.3.8" }));
    const result = await discoverLocalHttpModels(
      {
        productId: "local-openai",
        endpoint: LM_STUDIO_ENDPOINT,
        auth: { authentication: "none" },
      },
      { fetch, lookup: lookupLoopback() },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.runtime).toEqual({ identity: "lm-studio", version: "lm-studio-0.3.8" });
    expect(result.value.models[0]?.modelId).toBe("local-model");
  });

  it("exports ollama and local-openai adapters with local-http transport family", () => {
    expect(ollamaAdapter.productId).toBe("ollama");
    expect(ollamaAdapter.transportFamily).toBe("local-http");
    expect(localOpenaiAdapter.productId).toBe("local-openai");
    expect(localOpenaiAdapter.transportFamily).toBe("local-http");
  });

  it("completes local-openai adapter execution with schema-valid review output", async () => {
    const fetch = createMockFetch(
      openAiRoutes({
        serverVersion: "b-version-2026-07",
        chatBody: () => ({ choices: [{ message: { content: '{"issues":[]}' } }] }),
      }),
    );
    const adapter = createLocalHttpAdapter("local-openai", { fetch, lookup: lookupLoopback() });
    const evidenceKey = {
      authentication: "none",
      credentialReferenceIdentity: null,
      installationId: null,
      productId: "local-openai",
      transportFamily: "local-http",
      normalizedEndpoint: LLAMA_CPP_ENDPOINT,
      region: null,
      workspaceAccountReference: null,
      modelId: "local-model",
      runtime: { identity: "llama-cpp", version: "b-version-2026-07" },
      structuredOutputSchemaSha256: SCHEMA_SHA256,
      noticeVersion: 1,
      limits: LIMITS,
    } satisfies EvidenceKey;

    const result = await adapter.execute({
      configurationId: "cfg-2",
      configurationRevision: 2,
      evidenceKey,
      prompt: "review",
    });
    expect(result.receipt.outcome).toBe("completed");
    expect(result.result.issues).toEqual([]);
  });

  it("completes ollama adapter execution with schema-valid review output", async () => {
    const fetch = createMockFetch(
      ollamaRoutes({
        chatBody: () => ({ message: { content: '{"issues":[]}' } }),
      }),
    );
    const adapter = createLocalHttpAdapter("ollama", { fetch, lookup: lookupLoopback() });
    const evidenceKey = {
      authentication: "none",
      credentialReferenceIdentity: null,
      installationId: null,
      productId: "ollama",
      transportFamily: "local-http",
      normalizedEndpoint: OLLAMA_ENDPOINT,
      region: null,
      workspaceAccountReference: null,
      modelId: "llama3.2",
      runtime: { identity: "ollama", version: "0.6.0" },
      structuredOutputSchemaSha256: SCHEMA_SHA256,
      noticeVersion: 1,
      limits: LIMITS,
    } satisfies EvidenceKey;

    const result = await adapter.execute({
      configurationId: "cfg-3",
      configurationRevision: 3,
      evidenceKey,
      prompt: "review",
    });
    expect(result.receipt.outcome).toBe("completed");
    expect(result.result.issues).toEqual([]);
  });

  it("sends Authorization bearer on adapter execute when authentication is optional-local-bearer", async () => {
    const authorizationHeaders: string[] = [];
    const routes = ollamaRoutes({
      chatBody: () => ({ message: { content: '{"issues":[]}' } }),
    }).map((route) => ({
      ...route,
      handler: async (request: Request) => {
        const authorization = request.headers.get("Authorization");
        if (authorization) authorizationHeaders.push(authorization);
        return route.handler(request);
      },
    }));
    const fetch = createMockFetch(routes);
    const adapter = createLocalHttpAdapter("ollama", {
      fetch,
      lookup: lookupLoopback(),
      resolveBearerToken: async () => "local-bearer-token",
    });
    const evidenceKey = {
      authentication: "optional-local-bearer",
      credentialReferenceIdentity: "2".repeat(64),
      installationId: null,
      productId: "ollama",
      transportFamily: "local-http",
      normalizedEndpoint: OLLAMA_ENDPOINT,
      region: null,
      workspaceAccountReference: null,
      modelId: "llama3.2",
      runtime: { identity: "ollama", version: "0.6.0" },
      structuredOutputSchemaSha256: SCHEMA_SHA256,
      noticeVersion: 1,
      limits: LIMITS,
    } satisfies EvidenceKey;

    const result = await adapter.execute({
      configurationId: "cfg-bearer",
      configurationRevision: 1,
      evidenceKey,
      prompt: "review",
    });

    expect(result.receipt.outcome).toBe("completed");
    expect(authorizationHeaders).toContain("Bearer local-bearer-token");
  });
});

const EVIDENCE_KEY = {
  authentication: "none",
  credentialReferenceIdentity: null,
  installationId: null,
  productId: "ollama",
  transportFamily: "local-http",
  normalizedEndpoint: OLLAMA_ENDPOINT,
  region: null,
  workspaceAccountReference: null,
  modelId: "llama3.2",
  runtime: { identity: "ollama", version: "0.6.0" },
  structuredOutputSchemaSha256: SCHEMA_SHA256,
  noticeVersion: 1,
  limits: LIMITS,
} satisfies EvidenceKey;

describe("local generation contract", () => {
  it("sends the review-result schema for generation, not the conformance probe schema", async () => {
    let chatBody: Record<string, unknown> | undefined;
    const fetch = createMockFetch(
      ollamaRoutes({
        chatBody: () => ({ message: { content: JSON.stringify({ issues: [] }) } }),
      }).map((route) =>
        route.method === "POST"
          ? {
              ...route,
              handler: async (request: Request) => {
                chatBody = (await request.clone().json()) as Record<string, unknown>;
                return route.handler(request);
              },
            }
          : route,
      ),
    );
    const adapter = createLocalHttpAdapter("ollama", { fetch, lookup: lookupLoopback() });

    const result = await adapter.execute({
      configurationId: "cfg-1",
      configurationRevision: 1,
      evidenceKey: EVIDENCE_KEY,
      prompt: "review this diff",
    });

    expect(result.receipt.outcome).toBe("completed");
    const format = chatBody?.format as { properties?: Record<string, unknown> } | undefined;
    expect(Object.keys(format?.properties ?? {})).toContain("issues");
    expect(Object.keys(format?.properties ?? {})).not.toContain("status");
  });

  it("aborts a streamed response once it crosses the admitted byte cap", async () => {
    let pulledChunks = 0;
    const chunk = new TextEncoder().encode("x".repeat(512));
    const fetch = createMockFetch([
      ...ollamaRoutes().filter((route) => route.method !== "POST"),
      {
        method: "POST",
        match: (url) => url.includes("/api/chat"),
        handler: () =>
          new Response(
            new ReadableStream<Uint8Array>({
              pull(controller) {
                pulledChunks += 1;
                controller.enqueue(chunk);
              },
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          ),
      },
    ]);
    const adapter = createLocalHttpAdapter("ollama", { fetch, lookup: lookupLoopback() });

    const result = await adapter.execute({
      configurationId: "cfg-1",
      configurationRevision: 1,
      evidenceKey: { ...EVIDENCE_KEY, limits: { ...LIMITS, maxResponseBytes: 2_048 } },
      prompt: "review this diff",
    });

    expect(result.receipt.outcome).toBe("transport-failed");
    expect(pulledChunks).toBeLessThan(16);
  });

  it("times out a generation that outlives the admitted wall time", async () => {
    const fetch = createMockFetch([
      ...ollamaRoutes().filter((route) => route.method !== "POST"),
      {
        method: "POST",
        match: (url) => url.includes("/api/chat"),
        handler: (request) =>
          new Promise<Response>((_resolve, reject) => {
            request.signal.addEventListener("abort", () =>
              reject(new DOMException("aborted", "AbortError")),
            );
          }),
      },
    ]);
    const adapter = createLocalHttpAdapter("ollama", { fetch, lookup: lookupLoopback() });

    const result = await adapter.execute({
      configurationId: "cfg-1",
      configurationRevision: 1,
      evidenceKey: { ...EVIDENCE_KEY, limits: { ...LIMITS, wallTimeMs: 50 } },
      prompt: "review this diff",
    });

    expect(result.receipt.outcome).toBe("timed-out");
  });
});

describe("conformance endpoint resolution", () => {
  it("propagates endpoint-forbidden instead of probing the unvalidated endpoint", async () => {
    const fetch = vi.fn(async () => jsonResponse({ version: "0.6.0" }));
    const result = await probeLocalHttpConformance(
      {
        productId: "ollama",
        endpoint: "http://example.com:11434",
        modelId: "llama3.2",
        auth: { authentication: "none" },
        structuredOutputSchemaSha256: SCHEMA_SHA256,
      },
      { fetch, lookup: async () => [{ address: "93.184.216.34", family: 4 }] },
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("endpoint-forbidden");
    expect(fetch).not.toHaveBeenCalled();
  });
});
