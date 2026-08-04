import { PRODUCT_REGISTRY } from "@diffgazer/core/providers";
import { HOSTED_API_PRODUCT_IDS, type HostedApiProductId } from "@diffgazer/core/schemas/config";
import { type EvidenceKey, ExecutionResultSchema } from "@diffgazer/core/schemas/review";
import { makeIssue } from "@diffgazer/core/testing/factories";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createBudgetLedger } from "../../budget/ledger.js";
import {
  createHostedAdapter,
  DEFAULT_HOSTED_REVIEW_SCHEMA,
  executeHostedReview,
  HOSTED_ADAPTERS,
  validateHostedEndpoint,
} from "./transport.js";

type FetchFn = typeof globalThis.fetch;
type MockFetchFn = ReturnType<typeof vi.fn<FetchFn>>;

const SCHEMA_SHA256 = "1".repeat(64);
const CREDENTIAL_REFERENCE_IDENTITY = "3".repeat(64);
const WORKSPACE_ACCOUNT_REFERENCE = "4".repeat(64);
const TEST_CREDENTIAL = "sk-test-hosted-credential-value";

const STRUCTURED_OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    issues: {
      type: "array",
      items: { type: "object" },
    },
  },
  required: ["issues"],
} as const;

const limits = {
  maxInputTokens: 20_000,
  maxOutputTokens: 4_000,
  maxResponseBytes: 1_048_576,
  wallTimeMs: 120_000,
  maxRetries: 2,
  maxConcurrency: 1,
  maxCostUsd: 0.5,
} as const;

function suggestedModelId(productId: HostedApiProductId): string {
  const policy = PRODUCT_REGISTRY[productId].modelPolicy;
  if ("suggestedModelId" in policy && policy.suggestedModelId) {
    return policy.suggestedModelId;
  }
  if (productId === "openrouter") return "anthropic/claude-3.7-sonnet";
  if (productId === "moonshot") return "kimi-k3-2026-01";
  return "model-1";
}

function evidenceKeyFor(
  productId: HostedApiProductId,
  patch: Partial<EvidenceKey> = {},
): EvidenceKey {
  const product = PRODUCT_REGISTRY[productId];
  const endpoint = product.configuration.endpoints[0];
  const region = endpoint && "region" in endpoint ? (endpoint.region ?? null) : null;
  const workspaceAccountReference =
    endpoint && "workspaceBound" in endpoint && endpoint.workspaceBound
      ? WORKSPACE_ACCOUNT_REFERENCE
      : null;

  return {
    authentication: null,
    credentialReferenceIdentity: CREDENTIAL_REFERENCE_IDENTITY,
    installationId: null,
    productId,
    transportFamily: "hosted-api",
    normalizedEndpoint: endpoint?.endpoint ?? "https://example.invalid/v1",
    region,
    workspaceAccountReference,
    modelId: suggestedModelId(productId),
    runtime: { identity: "diffgazer-server", version: "1.2.3" },
    structuredOutputSchemaSha256: SCHEMA_SHA256,
    noticeVersion: product.notice.noticeVersion,
    limits,
    ...patch,
  };
}

function openAiSuccessBody(content: unknown, usage?: Record<string, number>) {
  return {
    choices: [{ message: { content: JSON.stringify(content) }, finish_reason: "stop" }],
    usage: usage ?? { prompt_tokens: 12, completion_tokens: 8, total_tokens: 20 },
  };
}

function googleSuccessBody(content: unknown, usage?: Record<string, number>) {
  return {
    candidates: [
      {
        content: { parts: [{ text: JSON.stringify(content) }] },
        finishReason: "STOP",
      },
    ],
    usageMetadata: usage ?? {
      promptTokenCount: 12,
      candidatesTokenCount: 8,
      totalTokenCount: 20,
    },
  };
}

function mockFetchResponse(
  body: unknown,
  init: { status?: number; headers?: Record<string, string>; redirected?: boolean } = {},
): FetchFn {
  return vi.fn(async () => {
    const payload = typeof body === "string" ? body : JSON.stringify(body);
    const response = new Response(payload, {
      status: init.status ?? 200,
      headers: { "content-type": "application/json", ...(init.headers ?? {}) },
    });
    if (init.redirected) {
      Object.defineProperty(response, "redirected", { value: true });
    }
    return response;
  }) as FetchFn;
}

function executeRequest(productId: HostedApiProductId, patch: Partial<EvidenceKey> = {}) {
  return {
    configurationId: "configuration-1",
    configurationRevision: 3,
    evidenceKey: evidenceKeyFor(productId, patch),
    prompt: "review this diff",
  };
}

function hostedContext(fetch: FetchFn, patch: Record<string, unknown> = {}) {
  return {
    credential: TEST_CREDENTIAL,
    reviewSchema: DEFAULT_HOSTED_REVIEW_SCHEMA,
    structuredOutputSchema: STRUCTURED_OUTPUT_SCHEMA,
    fetch,
    ...patch,
  };
}

describe("validateHostedEndpoint", () => {
  it("rejects invalid hosted endpoints before secret resolution", () => {
    const result = validateHostedEndpoint({
      productId: "groq",
      endpoint: "http://api.groq.com/openai/v1",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("http-hosted-forbidden");
  });
});

describe("existing hosted provider continuity", () => {
  it.each([
    "gemini",
    "zai",
    "openrouter",
    "groq",
    "cerebras",
  ] as const)("completes %s with bounded receipt and schema-valid findings", async (productId) => {
    const review = { issues: [makeIssue()] };
    const fetch =
      productId === "gemini"
        ? mockFetchResponse(googleSuccessBody(review))
        : mockFetchResponse(openAiSuccessBody(review));

    const result = await executeHostedReview({
      ...executeRequest(productId),
      context: hostedContext(fetch),
    });

    expect(result.receipt.outcome).toBe("completed");
    expect(result.receipt.productId).toBe(productId);
    expect(result.result.issues).toHaveLength(1);
    expect(ExecutionResultSchema.safeParse(result).success).toBe(true);
    expect((fetch as MockFetchFn).mock.calls[0]?.[0]).toBe(
      productId === "gemini"
        ? `${evidenceKeyFor(productId).normalizedEndpoint}/models/${encodeURIComponent(
            evidenceKeyFor(productId).modelId,
          )}:generateContent`
        : `${evidenceKeyFor(productId).normalizedEndpoint}/chat/completions`,
    );
  });
});

describe("add-now PAYG tuple model and notice policies", () => {
  it("binds DeepSeek to its exact endpoint and allowlisted model", async () => {
    const fetch = mockFetchResponse(
      openAiSuccessBody(
        { issues: [] },
        { prompt_tokens: 4, completion_tokens: 2, total_tokens: 6 },
      ),
    );

    const result = await executeHostedReview({
      ...executeRequest("deepseek"),
      context: hostedContext(fetch),
    });

    expect(result.receipt.outcome).toBe("completed");
    expect(result.receipt.normalizedEndpoint).toBe("https://api.deepseek.com/v1");
    expect(result.receipt.modelId).toBe("deepseek-v4-flash");
    expect(result.receipt.usageAvailability).toBe("reported");
  });

  it("binds Qwen to international workspace tuple and required usage", async () => {
    const fetch = mockFetchResponse(
      openAiSuccessBody(
        { issues: [] },
        { prompt_tokens: 5, completion_tokens: 3, total_tokens: 8 },
      ),
    );

    const result = await executeHostedReview({
      ...executeRequest("qwen"),
      context: hostedContext(fetch, { workspaceAccountId: "ws-test-123" }),
    });

    expect(result.receipt.outcome).toBe("completed");
    expect(result.receipt.region).toBe("international");
    expect(result.receipt.workspace).toBe(WORKSPACE_ACCOUNT_REFERENCE);
    expect(result.receipt.usageAvailability).toBe("reported");

    const [, init] = (fetch as MockFetchFn).mock.calls[0] ?? [];
    expect((init as RequestInit).headers).toMatchObject({
      "x-dashscope-workspace": "ws-test-123",
    });
  });

  it("rejects Qwen without workspace before sending a secret", async () => {
    const fetch = mockFetchResponse(openAiSuccessBody({ issues: [] }));
    const result = await executeHostedReview({
      ...executeRequest("qwen"),
      context: hostedContext(fetch),
    });

    expect(result.receipt.outcome).toBe("transport-failed");
    expect(result.result.issues).toEqual([]);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("isolates Moonshot by region endpoint tuple", async () => {
    const fetch = mockFetchResponse(
      openAiSuccessBody(
        { issues: [] },
        { prompt_tokens: 6, completion_tokens: 2, total_tokens: 8 },
      ),
    );

    const result = await executeHostedReview({
      ...executeRequest("moonshot", {
        normalizedEndpoint: "https://api.moonshot.ai/v1",
        region: "international",
        modelId: "kimi-k3-2026-01",
      }),
      context: hostedContext(fetch),
    });

    expect(result.receipt.outcome).toBe("completed");
    expect(result.receipt.region).toBe("international");
    expect(result.receipt.usageAvailability).toBe("reported");
  });

  it("rejects invalid hosted endpoint tuple before secret use", async () => {
    const fetch = mockFetchResponse(openAiSuccessBody({ issues: [] }));
    const result = validateHostedEndpoint({
      productId: "moonshot",
      endpoint: "https://api.moonshot.cn/v1",
      region: "international",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("cross-region");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("honors Mistral notice version and regional endpoint choice", async () => {
    const fetch = mockFetchResponse({
      choices: [{ message: { content: JSON.stringify({ issues: [] }) }, finish_reason: "stop" }],
    });
    const result = await executeHostedReview({
      ...executeRequest("mistral", {
        normalizedEndpoint: "https://api.eu.mistral.ai/v1",
        region: "eu",
      }),
      context: hostedContext(fetch),
    });

    expect(result.receipt.outcome).toBe("completed");
    expect(result.receipt.region).toBe("eu");
    expect(result.receipt.noticeVersion).toBe(PRODUCT_REGISTRY.mistral.notice.noticeVersion);
    expect(result.receipt.usageAvailability).toBe("unavailable");
  });

  it("fails closed when notice version does not match the product registry", async () => {
    const fetch = mockFetchResponse(openAiSuccessBody({ issues: [] }));
    const result = await executeHostedReview({
      ...executeRequest("mistral", { noticeVersion: 999 }),
      context: hostedContext(fetch),
    });

    expect(result.receipt.outcome).toBe("transport-failed");
    expect(result.result.issues).toEqual([]);
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe("usage contracts", () => {
  it("marks optional-usage providers unavailable when usage is absent", async () => {
    const fetch = mockFetchResponse({
      choices: [{ message: { content: JSON.stringify({ issues: [] }) }, finish_reason: "stop" }],
    });

    const result = await executeHostedReview({
      ...executeRequest("groq"),
      context: hostedContext(fetch),
    });

    expect(result.receipt.outcome).toBe("completed");
    expect(result.receipt.usageAvailability).toBe("unavailable");
    expect(result.receipt.usage).toBeUndefined();
  });

  it("fails required-terminal providers when usage is missing", async () => {
    const fetch = mockFetchResponse({
      choices: [{ message: { content: JSON.stringify({ issues: [] }) }, finish_reason: "stop" }],
    });

    const result = await executeHostedReview({
      ...executeRequest("deepseek"),
      context: hostedContext(fetch),
    });

    expect(result.receipt.outcome).toBe("transport-failed");
    expect(result.receipt.usageAvailability).toBe("required-missing");
    expect(result.result.issues).toEqual([]);
  });
});

describe("failure outcomes emit zero findings without fallback", () => {
  it("returns schema-failed for malformed JSON content", async () => {
    const fetch = mockFetchResponse({
      choices: [{ message: { content: "not-json" }, finish_reason: "stop" }],
      usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
    });

    const result = await executeHostedReview({
      ...executeRequest("groq"),
      context: hostedContext(fetch),
    });

    expect(result.receipt.outcome).toBe("schema-failed");
    expect(result.result.issues).toEqual([]);
  });

  it("returns transport-failed for oversized responses", async () => {
    const huge = "x".repeat(2_048);
    const fetch = mockFetchResponse(openAiSuccessBody({ issues: [], filler: huge }));

    const result = await executeHostedReview({
      ...executeRequest("groq", {
        limits: { ...limits, maxResponseBytes: 256 },
      }),
      context: hostedContext(fetch),
    });

    expect(result.receipt.outcome).toBe("transport-failed");
    expect(result.result.issues).toEqual([]);
  });

  it("returns transport-failed for redirecting upstream responses", async () => {
    const fetch = vi.fn(async () => {
      throw new TypeError("redirect mode is error");
    }) as FetchFn;

    const result = await executeHostedReview({
      ...executeRequest("groq"),
      context: hostedContext(fetch),
    });

    expect(result.receipt.outcome).toBe("transport-failed");
    expect(result.result.issues).toEqual([]);
  });

  it("returns transport-failed for rate-limited upstream responses", async () => {
    const fetch = mockFetchResponse({ error: "rate limited" }, { status: 429 });

    const result = await executeHostedReview({
      ...executeRequest("groq"),
      context: hostedContext(fetch),
    });

    expect(result.receipt.outcome).toBe("transport-failed");
    expect(result.result.issues).toEqual([]);
  });

  it("returns cancelled when the abort signal is already aborted", async () => {
    const fetch = mockFetchResponse(openAiSuccessBody({ issues: [] }));
    const controller = new AbortController();
    controller.abort();

    const result = await executeHostedReview({
      ...executeRequest("groq"),
      signal: controller.signal,
      context: hostedContext(fetch),
    });

    expect(result.receipt.outcome).toBe("cancelled");
    expect(result.result.issues).toEqual([]);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("returns budget-exhausted when the ledger cannot reserve an attempt", async () => {
    const fetch = mockFetchResponse(openAiSuccessBody({ issues: [] }));
    const ledger = createBudgetLedger({ ...limits, maxRetries: 0, maxConcurrency: 1 });
    ledger.reserveAttempt({
      inputTokens: 100,
      outputTokens: 50,
      responseBytes: 1_024,
      wallTimeMs: 1_000,
      costUsd: 0.01,
    });

    const result = await executeHostedReview({
      ...executeRequest("groq"),
      context: hostedContext(fetch, { budgetLedger: ledger }),
    });

    expect(result.receipt.outcome).toBe("budget-exhausted");
    expect(result.result.issues).toEqual([]);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("retries json-object providers once for malformed output then fails closed", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [{ message: { content: "{" }, finish_reason: "stop" }],
            usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [{ message: { content: "still-not-json" }, finish_reason: "stop" }],
            usage: { prompt_tokens: 2, completion_tokens: 2, total_tokens: 4 },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      ) as FetchFn;

    const result = await executeHostedReview({
      ...executeRequest("zai"),
      context: hostedContext(fetch),
    });

    expect(fetch).toHaveBeenCalledTimes(2);
    expect(result.receipt.outcome).toBe("schema-failed");
    expect(result.receipt.attemptCount).toBe(2);
    expect(result.result.issues).toEqual([]);
  });

  it("retries DeepSeek once for malformed output then fails closed", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [{ message: { content: "{" }, finish_reason: "stop" }],
            usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [{ message: { content: "still-not-json" }, finish_reason: "stop" }],
            usage: { prompt_tokens: 2, completion_tokens: 2, total_tokens: 4 },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      ) as FetchFn;

    const result = await executeHostedReview({
      ...executeRequest("deepseek"),
      context: hostedContext(fetch),
    });

    expect(fetch).toHaveBeenCalledTimes(2);
    expect(result.receipt.outcome).toBe("schema-failed");
    expect(result.receipt.attemptCount).toBe(2);
    expect(result.result.issues).toEqual([]);
  });
});

describe("hosted adapter factory", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("exports one adapter per hosted product id", () => {
    expect(Object.keys(HOSTED_ADAPTERS).sort()).toEqual([...HOSTED_API_PRODUCT_IDS].sort());
  });

  it("fails closed when the request carries no authorized credential channel", async () => {
    const adapter = createHostedAdapter("gemini");
    const result = await adapter.execute(executeRequest("gemini"));

    expect(result.receipt.outcome).toBe("transport-failed");
    expect(result.result.issues).toEqual([]);
  });

  it("executes with the credential the authorized execution channel resolves", async () => {
    const fetch = mockFetchResponse(googleSuccessBody({ issues: [] }));
    vi.spyOn(globalThis, "fetch").mockImplementation(fetch);
    const adapter = createHostedAdapter("gemini");

    const result = await adapter.execute({
      ...executeRequest("gemini"),
      resolveCredential: async () => TEST_CREDENTIAL,
    });

    expect(result.receipt.outcome).toBe("completed");
    const init = vi.mocked(fetch).mock.calls[0]?.[1];
    expect((init?.headers as Record<string, string>)["x-goog-api-key"]).toBe(TEST_CREDENTIAL);
  });

  it("sends the workspace account the authorized execution channel supplies", async () => {
    const fetch = mockFetchResponse(openAiSuccessBody({ issues: [] }));
    vi.spyOn(globalThis, "fetch").mockImplementation(fetch);
    const adapter = createHostedAdapter("qwen");

    const result = await adapter.execute({
      ...executeRequest("qwen"),
      resolveCredential: async () => TEST_CREDENTIAL,
      workspaceAccountId: "ws-account-1",
    });

    expect(result.receipt.outcome).toBe("completed");
    const init = vi.mocked(fetch).mock.calls[0]?.[1];
    expect((init?.headers as Record<string, string>)["x-dashscope-workspace"]).toBe("ws-account-1");
  });

  it("delegates to executeHostedReview when dependencies are provided", async () => {
    const fetch = mockFetchResponse(googleSuccessBody({ issues: [] }));
    const adapter = createHostedAdapter("gemini", {
      resolveContext: async () => hostedContext(fetch),
    });

    const result = await adapter.execute(executeRequest("gemini"));
    expect(result.receipt.outcome).toBe("completed");
    expect(result.result.issues).toEqual([]);
  });
});

describe("admitted attempt accounting", () => {
  it("honours an admitted maxRetries of 0 over the provider's malformed-output retry", async () => {
    const fetch = vi.fn(
      async () =>
        new Response(JSON.stringify(openAiSuccessBody("not-json-at-all")), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    ) as MockFetchFn;

    const result = await executeHostedReview({
      ...executeRequest("zai", { limits: { ...limits, maxRetries: 0 } }),
      context: hostedContext(fetch),
    });

    expect(result.receipt.outcome).toBe("schema-failed");
    expect(result.receipt.attemptCount).toBe(1);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("reserves every retry against the per-review ledger", async () => {
    const fetch = vi.fn(
      async () =>
        new Response(JSON.stringify(openAiSuccessBody("not-json-at-all")), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    ) as MockFetchFn;
    const ledger = createBudgetLedger({ ...limits, maxRetries: 1 });

    const result = await executeHostedReview({
      ...executeRequest("zai"),
      context: hostedContext(fetch, { budgetLedger: ledger }),
    });

    expect(result.receipt.outcome).toBe("schema-failed");
    expect(result.receipt.attemptCount).toBe(2);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(ledger.snapshot().inFlightAttempts).toBe(0);
  });

  it("settles budget-exhausted when the ledger denies a further attempt", async () => {
    const fetch = vi.fn(
      async () =>
        new Response(JSON.stringify(openAiSuccessBody("not-json-at-all")), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    ) as MockFetchFn;
    const ledger = createBudgetLedger(limits);
    const held = ledger.reserveAttempt({
      inputTokens: limits.maxInputTokens,
      outputTokens: limits.maxOutputTokens,
      responseBytes: limits.maxResponseBytes,
      wallTimeMs: limits.wallTimeMs,
      costUsd: limits.maxCostUsd,
    });
    expect(held.ok).toBe(true);

    const result = await executeHostedReview({
      ...executeRequest("zai"),
      context: hostedContext(fetch, { budgetLedger: ledger }),
    });

    expect(result.receipt.outcome).toBe("budget-exhausted");
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe("rate-limit diagnostics", () => {
  it("caps the 429 diagnostic read instead of buffering the whole body", async () => {
    let pulledChunks = 0;
    const chunk = new TextEncoder().encode("x".repeat(8 * 1024));
    const fetch = vi.fn(
      async () =>
        new Response(
          new ReadableStream<Uint8Array>({
            pull(controller) {
              pulledChunks += 1;
              controller.enqueue(chunk);
            },
          }),
          { status: 429, headers: { "content-type": "application/json" } },
        ),
    ) as MockFetchFn;

    const result = await executeHostedReview({
      ...executeRequest("groq"),
      context: hostedContext(fetch),
    });

    expect(result.receipt.outcome).toBe("transport-failed");
    expect(pulledChunks).toBeLessThanOrEqual(16);
  });
});
