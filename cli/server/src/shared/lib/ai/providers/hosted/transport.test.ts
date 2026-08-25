import { PRODUCT_REGISTRY } from "@diffgazer/core/providers";
import { HOSTED_API_PRODUCT_IDS, type HostedApiProductId } from "@diffgazer/core/schemas/config";
import { type EvidenceKey, ExecutionResultSchema } from "@diffgazer/core/schemas/review";
import { makeIssue } from "@diffgazer/core/testing/factories";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  boundedFetchInit as canonicalBoundedFetchInit,
  resolveHostedApiEndpoint,
} from "../endpoints.js";
import {
  boundedFetchInit,
  createHostedAdapter,
  DEFAULT_HOSTED_REVIEW_SCHEMA,
  executeHostedReview,
  HOSTED_ADAPTERS,
  validateHostedEndpoint,
} from "./transport.js";

type FetchFn = typeof globalThis.fetch;
type MockFetchFn = ReturnType<typeof vi.fn<FetchFn>>;
type HostedEvidenceKey = Extract<EvidenceKey, { transportFamily: "hosted-api" }>;

const SCHEMA_SHA256 = "1".repeat(64);
const CREDENTIAL_REFERENCE_IDENTITY = "3".repeat(64);
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

type TransportExecuteRequest = Parameters<typeof executeHostedReview>[0];
type TransportExecuteResult = Awaited<ReturnType<typeof executeHostedReview>>;
const transportFacadeTypes: {
  request: TransportExecuteRequest;
  result: TransportExecuteResult;
} | null = null;

const limits = {
  maxInputTokens: 20_000,
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
  return "model-1";
}

function evidenceKeyFor(
  productId: HostedApiProductId,
  patch: Partial<HostedEvidenceKey> = {},
): EvidenceKey {
  const product = PRODUCT_REGISTRY[productId];
  const endpoint = product.configuration.endpoints[0];

  return {
    authentication: null,
    credentialReferenceIdentity: CREDENTIAL_REFERENCE_IDENTITY,
    installationId: null,
    productId,
    transportFamily: "hosted-api",
    normalizedEndpoint: endpoint?.endpoint ?? "https://example.invalid/v1",
    region: null,
    workspaceAccountReference: null,
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

function executeRequest(productId: HostedApiProductId, patch: Partial<HostedEvidenceKey> = {}) {
  return {
    configurationId: "configuration-1",
    configurationRevision: 3,
    evidenceKey: evidenceKeyFor(productId, patch),
    prompt: "review this diff",
  };
}

function hostedContext(fetch: FetchFn) {
  return {
    credential: TEST_CREDENTIAL,
    reviewSchema: DEFAULT_HOSTED_REVIEW_SCHEMA,
    structuredOutputSchema: STRUCTURED_OUTPUT_SCHEMA,
    fetch,
  };
}

function requestBodyAt(fetch: FetchFn, index: number): Record<string, unknown> {
  const init = (fetch as MockFetchFn).mock.calls[index]?.[1];
  return JSON.parse(String(init?.body)) as Record<string, unknown>;
}

describe("hosted transport facade", () => {
  it("re-exports canonical endpoint helpers without changing identity or types", () => {
    expect(boundedFetchInit).toBe(canonicalBoundedFetchInit);
    expect(validateHostedEndpoint).toBe(resolveHostedApiEndpoint);
    expect(transportFacadeTypes).toBeNull();

    const boundedInit = boundedFetchInit({ method: "POST" });
    expect(boundedInit).toEqual({ method: "POST", redirect: "error" });
    const endpoint = validateHostedEndpoint({
      productId: "groq",
      endpoint: "https://api.groq.com/openai/v1",
    });
    expect(endpoint.ok).toBe(true);
  });
});

describe("resolveHostedApiEndpoint", () => {
  it("rejects invalid hosted endpoints before secret resolution", () => {
    const result = resolveHostedApiEndpoint({
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

  it("drives Ollama Cloud through ollama.com with a bearer credential and JSON mode", async () => {
    const fetch = mockFetchResponse(openAiSuccessBody({ issues: [] }));

    const result = await executeHostedReview({
      ...executeRequest("ollama-cloud"),
      context: hostedContext(fetch),
    });

    expect(result.receipt.outcome).toBe("completed");
    expect(result.receipt.normalizedEndpoint).toBe("https://ollama.com/v1");
    expect(result.receipt.modelId).toBe("gpt-oss:20b");

    const [url, init] = (fetch as MockFetchFn).mock.calls[0] ?? [];
    expect(url).toBe("https://ollama.com/v1/chat/completions");
    expect((init as RequestInit).headers).toMatchObject({
      authorization: `Bearer ${TEST_CREDENTIAL}`,
    });
    // Ollama Cloud ignores json_schema, so the wire asks for JSON mode and the
    // review is validated locally.
    expect(requestBodyAt(fetch, 0).response_format).toEqual({ type: "json_object" });
  });

  // One key and one endpoint serve both Zen credits and an OpenCode Go
  // subscription, so the wire must be the same either way: a bearer credential
  // to /zen/v1 asking for JSON mode, with the review validated locally.
  it("drives OpenCode Zen through its gateway with a bearer credential and JSON mode", async () => {
    const fetch = mockFetchResponse(openAiSuccessBody({ issues: [makeIssue()] }));

    const result = await executeHostedReview({
      ...executeRequest("opencode-zen"),
      context: hostedContext(fetch),
    });

    expect(result.receipt.outcome).toBe("completed");
    expect(result.receipt.normalizedEndpoint).toBe("https://opencode.ai/zen/v1");
    expect(result.result.issues).toHaveLength(1);

    const [url, init] = (fetch as MockFetchFn).mock.calls[0] ?? [];
    expect(url).toBe("https://opencode.ai/zen/v1/chat/completions");
    expect((init as RequestInit).headers).toMatchObject({
      authorization: `Bearer ${TEST_CREDENTIAL}`,
    });
    expect(requestBodyAt(fetch, 0).response_format).toEqual({ type: "json_object" });
  });

  it("carries the notice version the product registry pins", async () => {
    const fetch = mockFetchResponse({
      choices: [{ message: { content: JSON.stringify({ issues: [] }) }, finish_reason: "stop" }],
    });
    const result = await executeHostedReview({
      ...executeRequest("zai"),
      context: hostedContext(fetch),
    });

    expect(result.receipt.outcome).toBe("completed");
    expect(result.receipt.noticeVersion).toBe(PRODUCT_REGISTRY.zai.notice.noticeVersion);
    expect(result.receipt.usageAvailability).toBe("unavailable");
  });

  it("fails closed when notice version does not match the product registry", async () => {
    const fetch = mockFetchResponse(openAiSuccessBody({ issues: [] }));
    const result = await executeHostedReview({
      ...executeRequest("zai", { noticeVersion: 999 }),
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

  it("releases the response body of a rejected upstream status", async () => {
    let bodyCancelled = false;
    const fetch = vi.fn(async () => {
      const body = new ReadableStream<Uint8Array>({
        pull() {
          // Never resolves on its own: only an explicit cancel frees this stream.
        },
        cancel() {
          bodyCancelled = true;
        },
      });
      return new Response(body, {
        status: 503,
        headers: { "content-type": "application/json" },
      });
    }) as FetchFn;

    const result = await executeHostedReview({
      ...executeRequest("groq"),
      context: hostedContext(fetch),
    });

    expect(result.receipt.outcome).toBe("transport-failed");
    expect(bodyCancelled).toBe(true);
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

  it.each([
    [401, "Groq rejected the credential (HTTP 401)."],
    [403, "Groq refused access (HTTP 403)."],
    [402, "Groq reported billing or quota exhausted (HTTP 402)."],
    [404, "Groq could not find the selected model or endpoint (HTTP 404)."],
    [413, "Groq rejected the request as too large (HTTP 413)."],
    [429, "Groq rate limited the request (HTTP 429)."],
  ])("reports a refused HTTP %s response as a provider rejection the user can fix", async (status, message) => {
    const fetch = mockFetchResponse({ error: "sk-secret-abcdefghijklmnop" }, { status });
    const reportDiagnostic = vi.fn();

    const result = await executeHostedReview({
      ...executeRequest("groq"),
      reportDiagnostic,
      context: hostedContext(fetch),
    });

    expect(result.receipt.outcome).toBe("transport-failed");
    expect(reportDiagnostic).toHaveBeenCalledTimes(1);
    expect(reportDiagnostic).toHaveBeenCalledWith(
      expect.objectContaining({ code: "provider-rejected", safeMessage: message }),
    );
    expect(JSON.stringify(reportDiagnostic.mock.calls[0])).not.toContain(
      "sk-secret-abcdefghijklmnop",
    );
  });

  it("keeps a provider outage a plain transport failure", async () => {
    const fetch = mockFetchResponse({ error: "down" }, { status: 503 });
    const reportDiagnostic = vi.fn();

    await executeHostedReview({
      ...executeRequest("groq"),
      reportDiagnostic,
      context: hostedContext(fetch),
    });

    expect(reportDiagnostic).toHaveBeenCalledWith(
      expect.objectContaining({
        code: "transport-failed",
        retryable: true,
        safeMessage: "Groq returned HTTP 503.",
      }),
    );
  });

  it("times out a request that stalls past the admitted wall time", async () => {
    const fetch: FetchFn = (_url, init) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () =>
          reject(new DOMException("aborted", "AbortError")),
        );
      });

    const result = await executeHostedReview({
      ...executeRequest("groq", { limits: { ...limits, wallTimeMs: 50 } }),
      context: hostedContext(fetch),
    });

    expect(result.receipt.outcome).toBe("timed-out");
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

  it("returns budget-exhausted when the prompt exceeds the admitted input budget", async () => {
    const fetch = mockFetchResponse(openAiSuccessBody({ issues: [] }));

    const result = await executeHostedReview({
      ...executeRequest("groq", { limits: { ...limits, maxInputTokens: 1 } }),
      context: hostedContext(fetch),
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

  it("counts the discarded malformed attempt's billed tokens in the terminal receipt", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [{ message: { content: "{" }, finish_reason: "stop" }],
            usage: { prompt_tokens: 10, completion_tokens: 3, total_tokens: 13 },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [
              { message: { content: JSON.stringify({ issues: [] }) }, finish_reason: "stop" },
            ],
            usage: { prompt_tokens: 11, completion_tokens: 4, total_tokens: 15 },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      ) as FetchFn;

    const result = await executeHostedReview({
      ...executeRequest("zai"),
      context: hostedContext(fetch),
    });

    expect(result.receipt.outcome).toBe("completed");
    expect(result.receipt.attemptCount).toBe(2);
    // Discarding the first attempt's content does not un-bill its tokens.
    expect(result.receipt.usage).toMatchObject({
      inputTokens: 21,
      outputTokens: 7,
      totalTokens: 28,
    });
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

  it("fails closed without resolving credentials for a non-hosted evidence key", async () => {
    const resolveCredential = vi.fn(async () => TEST_CREDENTIAL);
    const adapter = createHostedAdapter("gemini");
    const result = await adapter.execute({
      ...executeRequest("gemini"),
      evidenceKey: {
        ...executeRequest("gemini").evidenceKey,
        authentication: "none",
        credentialReferenceIdentity: null,
        installationId: null,
        productId: "ollama",
        transportFamily: "local-http",
        normalizedEndpoint: "http://127.0.0.1:11434",
        region: null,
        workspaceAccountReference: null,
        runtime: { identity: "ollama", version: "0.6.0" },
        modelId: "llama3.2",
      },
      resolveCredential,
    });

    expect(result.receipt.outcome).toBe("transport-failed");
    expect(result.result.issues).toEqual([]);
    expect(resolveCredential).not.toHaveBeenCalled();
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

  it("delegates to executeHostedReview when dependencies are provided", async () => {
    const fetch = mockFetchResponse(googleSuccessBody({ issues: [] }));
    const adapter = createHostedAdapter("gemini", {
      resolveContext: async () => hostedContext(fetch),
    });

    const result = await adapter.execute(executeRequest("gemini"));
    expect(result.receipt.outcome).toBe("completed");
    expect(result.result.issues).toEqual([]);
  });

  it("maps Gemini thinking usage so totals equal input plus output tokens", async () => {
    const fetch = mockFetchResponse(
      googleSuccessBody(
        { issues: [] },
        {
          promptTokenCount: 8,
          candidatesTokenCount: 12,
          thoughtsTokenCount: 1076,
          totalTokenCount: 1096,
        },
      ),
    );

    const result = await executeHostedReview({
      ...executeRequest("gemini"),
      context: hostedContext(fetch),
    });

    expect(result.receipt.outcome).toBe("completed");
    expect(result.receipt.usage).toEqual({
      inputTokens: 8,
      outputTokens: 1088,
      totalTokens: 1096,
      reasoningTokens: 1076,
    });
  });
});

describe("admitted attempt accounting", () => {
  it("reserves the combined system and user input before dispatch", async () => {
    const fetch = mockFetchResponse(openAiSuccessBody({ issues: [] }));
    const result = await executeHostedReview({
      ...executeRequest("zai", { limits: { ...limits, maxInputTokens: 4 } }),
      systemPrompt: "trusted reviewer instructions",
      context: hostedContext(fetch),
    });

    expect(result.receipt.outcome).toBe("budget-exhausted");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("retries a billed malformed attempt without sending an output cap", async () => {
    const retryLimits = { ...limits, maxInputTokens: 40 } as const;
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [{ message: { content: "{" }, finish_reason: "stop" }],
            usage: { prompt_tokens: 8, completion_tokens: 3, total_tokens: 11 },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [
              { message: { content: JSON.stringify({ issues: [] }) }, finish_reason: "stop" },
            ],
            usage: { prompt_tokens: 8, completion_tokens: 2, total_tokens: 10 },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      ) as FetchFn;

    const result = await executeHostedReview({
      ...executeRequest("zai", { limits: retryLimits }),
      context: hostedContext(fetch),
    });

    expect(result.receipt.outcome).toBe("completed");
    expect(requestBodyAt(fetch, 0)).not.toHaveProperty("max_tokens");
    expect(requestBodyAt(fetch, 1)).not.toHaveProperty("max_tokens");
  });

  it("does not issue a retry when the reported prompt leaves insufficient input budget", async () => {
    const fetch = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            choices: [{ message: { content: "{" }, finish_reason: "stop" }],
            usage: { prompt_tokens: 16, completion_tokens: 1, total_tokens: 17 },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
    ) as MockFetchFn;

    const result = await executeHostedReview({
      ...executeRequest("zai", { limits: { ...limits, maxInputTokens: 20 } }),
      context: hostedContext(fetch),
    });

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(result.receipt.outcome).toBe("budget-exhausted");
    expect(result.receipt.usage).toMatchObject({ inputTokens: 16, outputTokens: 1 });
  });

  it("caps a retry response read at the remaining response-byte budget", async () => {
    const firstBody = JSON.stringify({
      choices: [{ message: { content: "{" }, finish_reason: "stop" }],
      usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
    });
    const firstBytes = new TextEncoder().encode(firstBody).byteLength;
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response(firstBody, { status: 200 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [
              { message: { content: JSON.stringify({ issues: [] }) }, finish_reason: "stop" },
            ],
            usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
          }),
          { status: 200 },
        ),
      ) as FetchFn;

    const result = await executeHostedReview({
      ...executeRequest("zai", {
        limits: { ...limits, maxResponseBytes: firstBytes + 4 },
      }),
      context: hostedContext(fetch),
    });

    expect(fetch).toHaveBeenCalledTimes(2);
    expect(result.receipt.outcome).toBe("budget-exhausted");
    expect(result.receipt.usage).toMatchObject({ inputTokens: 1, outputTokens: 1 });
  });

  it.each([
    ["missing", undefined],
    ["invalid", { prompt_tokens: 1, completion_tokens: "not-a-number", total_tokens: 1 }],
    ["inconsistent-total", { prompt_tokens: 1, completion_tokens: 1, total_tokens: 9 }],
    ["total-below-input", { prompt_tokens: 4, total_tokens: 3 }],
    ["total-below-output", { completion_tokens: 4, total_tokens: 3 }],
    ["total-below-cached", { total_tokens: 3, prompt_tokens_details: { cached_tokens: 4 } }],
    [
      "total-below-reasoning",
      { total_tokens: 3, completion_tokens_details: { reasoning_tokens: 4 } },
    ],
  ] as const)("does not retry when provider usage is %s", async (_label, usage) => {
    const body = {
      choices: [{ message: { content: "{" }, finish_reason: "stop" }],
      ...(usage === undefined ? {} : { usage }),
    };
    const fetch = vi.fn(
      async () =>
        new Response(JSON.stringify(body), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    ) as MockFetchFn;

    const result = await executeHostedReview({
      ...executeRequest("zai"),
      context: hostedContext(fetch),
    });

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(result.receipt.outcome).toBe("schema-failed");
    expect(result.receipt.usageAvailability).toBe("unavailable");
    expect(result.receipt.usage).toBeUndefined();
  });

  it("records partial usage without treating it as retry-safe", async () => {
    const fetch = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            choices: [{ message: { content: "{" }, finish_reason: "stop" }],
            usage: { prompt_tokens: 1 },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
    ) as MockFetchFn;

    const result = await executeHostedReview({
      ...executeRequest("zai"),
      context: hostedContext(fetch),
    });

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(result.receipt.outcome).toBe("schema-failed");
    expect(result.receipt.usageAvailability).toBe("reported");
    expect(result.receipt.usage).toEqual({ inputTokens: 1 });
  });

  it("keeps a valid partial provider total as the known input component", async () => {
    const fetch = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            choices: [{ message: { content: "{" }, finish_reason: "stop" }],
            usage: { prompt_tokens: 4, total_tokens: 4 },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
    ) as MockFetchFn;

    const result = await executeHostedReview({
      ...executeRequest("zai"),
      context: hostedContext(fetch),
    });

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(result.receipt.outcome).toBe("schema-failed");
    expect(result.receipt.usageAvailability).toBe("reported");
    expect(result.receipt.usage).toEqual({ inputTokens: 4 });
  });

  it("does not treat a total-only provider report as available usage", async () => {
    const fetch = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            choices: [{ message: { content: "{" }, finish_reason: "stop" }],
            usage: { total_tokens: 6 },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
    ) as MockFetchFn;

    const result = await executeHostedReview({
      ...executeRequest("zai"),
      context: hostedContext(fetch),
    });

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(result.receipt.outcome).toBe("schema-failed");
    expect(result.receipt.usageAvailability).toBe("unavailable");
    expect(result.receipt.usage).toBeUndefined();
  });

  it("fails closed for contradictory required-terminal usage", async () => {
    const fetch = mockFetchResponse({
      choices: [{ message: { content: "{" }, finish_reason: "stop" }],
      usage: { prompt_tokens: 4, total_tokens: 3 },
    });

    const result = await executeHostedReview({
      ...executeRequest("deepseek"),
      context: hostedContext(fetch),
    });

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(result.receipt.outcome).toBe("transport-failed");
    expect(result.receipt.usageAvailability).toBe("unavailable");
    expect(result.receipt.usage).toBeUndefined();
    expect(result.result.issues).toEqual([]);
  });

  it("derives an omitted attempt total and accumulates every known token component", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [{ message: { content: "{" }, finish_reason: "stop" }],
            usage: { prompt_tokens: 4, completion_tokens: 2, total_tokens: 6 },
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [
              { message: { content: JSON.stringify({ issues: [] }) }, finish_reason: "stop" },
            ],
            usage: { prompt_tokens: 4, completion_tokens: 2 },
          }),
          { status: 200 },
        ),
      ) as MockFetchFn;

    const result = await executeHostedReview({
      ...executeRequest("zai"),
      context: hostedContext(fetch),
    });

    expect(result.receipt.outcome).toBe("completed");
    expect(result.receipt.usageAvailability).toBe("reported");
    expect(result.receipt.usage).toEqual({
      inputTokens: 8,
      outputTokens: 4,
      totalTokens: 12,
    });
  });

  it("drops a mixed partial total and derives the aggregate from known components", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [{ message: { content: "{" }, finish_reason: "stop" }],
            usage: { prompt_tokens: 4, completion_tokens: 2, total_tokens: 6 },
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [
              { message: { content: JSON.stringify({ issues: [] }) }, finish_reason: "stop" },
            ],
            usage: { prompt_tokens: 4, total_tokens: 4 },
          }),
          { status: 200 },
        ),
      ) as MockFetchFn;

    const result = await executeHostedReview({
      ...executeRequest("zai"),
      context: hostedContext(fetch),
    });

    expect(fetch).toHaveBeenCalledTimes(2);
    expect(result.receipt.outcome).toBe("completed");
    expect(result.receipt.usageAvailability).toBe("reported");
    expect(result.receipt.usage).toEqual({
      inputTokens: 8,
      outputTokens: 2,
      totalTokens: 10,
    });
  });

  it.each([
    ["missing", undefined],
    ["invalid", { prompt_tokens: 4, completion_tokens: "not-a-number", total_tokens: 6 }],
  ] as const)("keeps the first trustworthy usage when the second response is %s", async (_label, usage) => {
    const first = {
      choices: [{ message: { content: "{" }, finish_reason: "stop" }],
      usage: { prompt_tokens: 4, completion_tokens: 2, total_tokens: 6 },
    };
    const second = {
      choices: [{ message: { content: JSON.stringify({ issues: [] }) }, finish_reason: "stop" }],
      ...(usage === undefined ? {} : { usage }),
    };
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(first), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(second), { status: 200 })) as MockFetchFn;

    const result = await executeHostedReview({
      ...executeRequest("zai", { limits: { ...limits, maxRetries: 1 } }),
      context: hostedContext(fetch),
    });

    expect(fetch).toHaveBeenCalledTimes(2);
    expect(result.receipt.outcome).toBe("completed");
    expect(result.receipt.usageAvailability).toBe("reported");
    expect(result.receipt.usage).toEqual({
      inputTokens: 4,
      outputTokens: 2,
      totalTokens: 6,
    });
  });

  it("retains the first attempt usage when the retry fails in transport", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [{ message: { content: "{" }, finish_reason: "stop" }],
            usage: { prompt_tokens: 4, completion_tokens: 2, total_tokens: 6 },
          }),
          { status: 200 },
        ),
      )
      .mockRejectedValueOnce(new Error("upstream disconnected")) as MockFetchFn;

    const result = await executeHostedReview({
      ...executeRequest("zai"),
      context: hostedContext(fetch),
    });

    expect(result.receipt.outcome).toBe("transport-failed");
    expect(result.receipt.usage).toMatchObject({
      inputTokens: 4,
      outputTokens: 2,
      totalTokens: 6,
    });
  });

  it("returns budget-exhausted with known provider usage over the admitted cap", async () => {
    const fetch = mockFetchResponse(
      openAiSuccessBody(
        { issues: [] },
        {
          prompt_tokens: limits.maxInputTokens + 1,
          completion_tokens: 1,
          total_tokens: limits.maxInputTokens + 2,
        },
      ),
    );

    const result = await executeHostedReview({
      ...executeRequest("groq"),
      context: hostedContext(fetch),
    });

    expect(result.receipt.outcome).toBe("budget-exhausted");
    expect(result.receipt.usage).toMatchObject({
      inputTokens: limits.maxInputTokens + 1,
      outputTokens: 1,
      totalTokens: limits.maxInputTokens + 2,
    });
  });

  it("keeps a completed answer whose total tokens exceed the input cap", async () => {
    const review = { issues: [makeIssue()] };
    const fetch = mockFetchResponse(
      openAiSuccessBody(review, {
        prompt_tokens: limits.maxInputTokens - 1_000,
        completion_tokens: 5_000,
        total_tokens: limits.maxInputTokens + 4_000,
      }),
    );

    const result = await executeHostedReview({
      ...executeRequest("groq"),
      context: hostedContext(fetch),
    });

    expect(result.receipt.outcome).toBe("completed");
    expect(result.result.issues).toHaveLength(1);
    expect(result.receipt.usage).toMatchObject({
      inputTokens: limits.maxInputTokens - 1_000,
      outputTokens: 5_000,
      totalTokens: limits.maxInputTokens + 4_000,
    });
  });

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

  it("retries every admitted attempt when the provider keeps returning malformed output", async () => {
    const fetch = vi.fn(
      async () =>
        new Response(JSON.stringify(openAiSuccessBody("not-json-at-all")), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    ) as MockFetchFn;

    const result = await executeHostedReview({
      ...executeRequest("zai", { limits: { ...limits, maxRetries: 1 } }),
      context: hostedContext(fetch),
    });

    expect(result.receipt.outcome).toBe("schema-failed");
    expect(result.receipt.attemptCount).toBe(2);
    expect(fetch).toHaveBeenCalledTimes(2);
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

describe("http error diagnostics", () => {
  const CONTEXT_LENGTH_BODY = {
    error: {
      code: 400,
      message:
        "This endpoint's maximum context length is 65536 tokens. However, you requested about 118420 tokens.",
    },
  };

  it("carries the provider's own 400 explanation and the context remediation", async () => {
    const fetch = mockFetchResponse(CONTEXT_LENGTH_BODY, { status: 400 });
    const reportDiagnostic = vi.fn();

    const result = await executeHostedReview({
      ...executeRequest("openrouter"),
      reportDiagnostic,
      context: hostedContext(fetch),
    });

    expect(result.receipt.outcome).toBe("transport-failed");
    expect(reportDiagnostic).toHaveBeenCalledWith(
      expect.objectContaining({
        code: "transport-failed",
        retryable: false,
        safeMessage: "OpenRouter rejected the request as invalid (HTTP 400).",
        remediation:
          "Often the diff is too large for the model's context window. Reduce the review scope, or choose a model with a larger context.",
      }),
    );
    expect(reportDiagnostic.mock.calls[0]?.[0].truncatedDetails).toContain(
      "maximum context length is 65536 tokens",
    );
  });

  it("redacts credentials echoed back in a 400 body", async () => {
    const fetch = mockFetchResponse(
      { error: { message: `key ${TEST_CREDENTIAL} rejected: sk-secret-abcdefghijklmnop` } },
      { status: 400 },
    );
    const reportDiagnostic = vi.fn();

    await executeHostedReview({
      ...executeRequest("openrouter"),
      reportDiagnostic,
      context: hostedContext(fetch),
    });

    const serialized = JSON.stringify(reportDiagnostic.mock.calls[0]);
    expect(serialized).not.toContain(TEST_CREDENTIAL);
    expect(serialized).not.toContain("sk-secret-abcdefghijklmnop");
  });

  it("caps the 400 diagnostic read instead of buffering the whole body", async () => {
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
          { status: 400, headers: { "content-type": "application/json" } },
        ),
    ) as MockFetchFn;

    const result = await executeHostedReview({
      ...executeRequest("openrouter"),
      context: hostedContext(fetch),
    });

    expect(result.receipt.outcome).toBe("transport-failed");
    expect(pulledChunks).toBeLessThanOrEqual(16);
  });

  it("does not capture the body of a 500 response", async () => {
    const fetch = mockFetchResponse({ error: "upstream stack trace" }, { status: 500 });
    const reportDiagnostic = vi.fn();

    await executeHostedReview({
      ...executeRequest("openrouter"),
      reportDiagnostic,
      context: hostedContext(fetch),
    });

    expect(reportDiagnostic).toHaveBeenCalledWith(
      expect.objectContaining({
        code: "transport-failed",
        safeMessage: "OpenRouter returned HTTP 500.",
      }),
    );
    expect(reportDiagnostic.mock.calls[0]?.[0].truncatedDetails).toBeUndefined();
  });
});

describe("gemini thinking budget", () => {
  function generationConfig(fetch: FetchFn): Record<string, unknown> {
    return requestBodyAt(fetch, 0).generationConfig as Record<string, unknown>;
  }

  it("bounds thought spend for a thinking-by-default model without capping the model's output", async () => {
    const fetch = mockFetchResponse(googleSuccessBody({ issues: [] }));

    const result = await executeHostedReview({
      ...executeRequest("gemini", { modelId: "gemini-2.5-pro" }),
      context: hostedContext(fetch),
    });

    expect(result.receipt.outcome).toBe("completed");
    expect(generationConfig(fetch)).toEqual({
      temperature: 0,
      responseMimeType: "application/json",
      thinkingConfig: { thinkingBudget: 2_048 },
      responseSchema: STRUCTURED_OUTPUT_SCHEMA,
    });
  });

  it("bounds thought spend for the registry's suggested gemini model", async () => {
    const fetch = mockFetchResponse(googleSuccessBody({ issues: [] }));

    await executeHostedReview({
      ...executeRequest("gemini"),
      context: hostedContext(fetch),
    });

    expect(generationConfig(fetch).thinkingConfig).toEqual({ thinkingBudget: 2_048 });
  });

  it.each([
    "gemini-2.5-flash-lite",
    "gemini-2.0-flash",
  ])("sends no thinking budget to %s, whose thinking is not on by default", async (modelId) => {
    const fetch = mockFetchResponse(googleSuccessBody({ issues: [] }));

    await executeHostedReview({
      ...executeRequest("gemini", { modelId }),
      context: hostedContext(fetch),
    });

    expect(generationConfig(fetch)).not.toHaveProperty("thinkingConfig");
  });
});

describe("hosted trust boundary", () => {
  function requestBody(fetch: FetchFn): Record<string, unknown> {
    const init = (fetch as MockFetchFn).mock.calls[0]?.[1];
    return JSON.parse(String(init?.body)) as Record<string, unknown>;
  }

  it("sends trusted instructions on the Google system channel, not the user turn", async () => {
    const fetch = mockFetchResponse(googleSuccessBody({ issues: [] }));

    const result = await executeHostedReview({
      ...executeRequest("gemini"),
      systemPrompt: "invariant reviewer instructions",
      context: hostedContext(fetch),
    });

    expect(result.receipt.outcome).toBe("completed");
    const body = requestBody(fetch);
    expect(body.systemInstruction).toEqual({
      parts: [{ text: "invariant reviewer instructions" }],
    });
    expect(body.contents).toEqual([{ role: "user", parts: [{ text: "review this diff" }] }]);
  });

  it("sends trusted instructions as an OpenAI system message ahead of the user turn", async () => {
    const fetch = mockFetchResponse(openAiSuccessBody({ issues: [] }));

    const result = await executeHostedReview({
      ...executeRequest("groq"),
      systemPrompt: "invariant reviewer instructions",
      context: hostedContext(fetch),
    });

    expect(result.receipt.outcome).toBe("completed");
    expect(requestBody(fetch).messages).toEqual([
      { role: "system", content: "invariant reviewer instructions" },
      { role: "user", content: "review this diff" },
    ]);
  });

  it("keeps a single user turn when no system prompt is supplied", async () => {
    const fetch = mockFetchResponse(openAiSuccessBody({ issues: [] }));

    await executeHostedReview({
      ...executeRequest("groq"),
      context: hostedContext(fetch),
    });

    expect(requestBody(fetch).messages).toEqual([{ role: "user", content: "review this diff" }]);
  });
});
