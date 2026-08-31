import { HOSTED_API_PRODUCT_IDS } from "@diffgazer/core/schemas/config";
import { afterEach, describe, expect, it, vi } from "vitest";

const readCachedLiveModelListMock = vi.hoisted(() => vi.fn());
vi.mock("../../live-model-lists.js", () => ({
  readCachedLiveModelList: readCachedLiveModelListMock,
}));

import {
  boundedFetchInit as canonicalBoundedFetchInit,
  resolveHostedApiEndpoint,
} from "../endpoints.js";
import {
  evidenceKeyFor,
  executeRequest,
  googleSuccessBody,
  hostedContext,
  mockFetchResponse,
  openAiSuccessBody,
  requestBodyAt,
  suggestedModelId,
  TEST_CREDENTIAL,
} from "./execute.test-support.js";
import {
  boundedFetchInit,
  createHostedAdapter,
  executeHostedReview,
  HOSTED_ADAPTERS,
} from "./transport.js";

describe("hosted transport facade", () => {
  it("re-exports canonical endpoint helpers without changing identity or types", () => {
    expect(boundedFetchInit).toBe(canonicalBoundedFetchInit);

    const boundedInit = boundedFetchInit({ method: "POST" });
    expect(boundedInit).toEqual({ method: "POST", redirect: "error" });
    const endpoint = resolveHostedApiEndpoint({
      productId: "openrouter",
      endpoint: "https://openrouter.ai/api/v1",
    });
    expect(endpoint.ok).toBe(true);
  });
});

describe("openrouter structured-output capability at dispatch", () => {
  const OPENROUTER_MODEL_ID = suggestedModelId("openrouter");

  function liveList(structuredOutput: boolean, reasoning?: boolean) {
    return {
      models: [
        {
          id: OPENROUTER_MODEL_ID,
          tier: "free" as const,
          structuredOutput,
          ...(reasoning === undefined ? {} : { reasoning }),
        },
      ],
      fetchedAt: new Date().toISOString(),
      cached: true,
    };
  }

  afterEach(() => {
    readCachedLiveModelListMock.mockReset();
    vi.restoreAllMocks();
  });

  it("keeps the strict schema and require_parameters on the strict path", async () => {
    const fetch = mockFetchResponse(openAiSuccessBody({ issues: [] }));

    const result = await executeHostedReview({
      ...executeRequest("openrouter"),
      context: hostedContext(fetch),
    });

    expect(result.receipt.outcome).toBe("completed");
    const body = requestBodyAt(fetch, 0);
    expect(body.provider).toEqual({ require_parameters: true });
    expect(body.response_format).toMatchObject({
      type: "json_schema",
      json_schema: { strict: true },
    });
  });

  it("degrades to JSON mode without require_parameters when the context mode says the route lacks structured outputs", async () => {
    const fetch = mockFetchResponse(openAiSuccessBody({ issues: [] }));

    const result = await executeHostedReview({
      ...executeRequest("openrouter"),
      context: { ...hostedContext(fetch), structuredOutputMode: "json-object-local-validation" },
    });

    expect(result.receipt.outcome).toBe("completed");
    const body = requestBodyAt(fetch, 0);
    expect(body.response_format).toEqual({ type: "json_object" });
    expect(body.provider).toBeUndefined();
  });

  it("degrades a dispatch whose live-list route does not declare structured_outputs", async () => {
    readCachedLiveModelListMock.mockReturnValue(liveList(false));
    const fetch = mockFetchResponse(openAiSuccessBody({ issues: [] }));
    vi.spyOn(globalThis, "fetch").mockImplementation(fetch);

    const result = await createHostedAdapter("openrouter").execute({
      ...executeRequest("openrouter"),
      resolveCredential: async () => TEST_CREDENTIAL,
    });

    expect(result.receipt.outcome).toBe("completed");
    expect(readCachedLiveModelListMock).toHaveBeenCalledWith({
      kind: "public",
      productId: "openrouter",
    });
    const body = requestBodyAt(fetch, 0);
    expect(body.response_format).toEqual({ type: "json_object" });
    expect(body.provider).toBeUndefined();
  });

  it("keeps strict dispatch for a route the live list marks structured-output capable", async () => {
    readCachedLiveModelListMock.mockReturnValue(liveList(true));
    const fetch = mockFetchResponse(openAiSuccessBody({ issues: [] }));
    vi.spyOn(globalThis, "fetch").mockImplementation(fetch);

    const result = await createHostedAdapter("openrouter").execute({
      ...executeRequest("openrouter"),
      resolveCredential: async () => TEST_CREDENTIAL,
    });

    expect(result.receipt.outcome).toBe("completed");
    const body = requestBodyAt(fetch, 0);
    expect(body.provider).toEqual({ require_parameters: true });
    expect(body.response_format).toMatchObject({ type: "json_schema" });
  });

  it("degrades when the live list is unavailable instead of risking a strict 404", async () => {
    readCachedLiveModelListMock.mockReturnValue(null);
    const fetch = mockFetchResponse(openAiSuccessBody({ issues: [] }));
    vi.spyOn(globalThis, "fetch").mockImplementation(fetch);

    const result = await createHostedAdapter("openrouter").execute({
      ...executeRequest("openrouter"),
      resolveCredential: async () => TEST_CREDENTIAL,
    });

    expect(result.receipt.outcome).toBe("completed");
    const body = requestBodyAt(fetch, 0);
    expect(body.response_format).toEqual({ type: "json_object" });
    expect(body.provider).toBeUndefined();
  });

  it("bounds reasoning spend for a strict route that declares the reasoning control", async () => {
    readCachedLiveModelListMock.mockReturnValue(liveList(true, true));
    const fetch = mockFetchResponse(openAiSuccessBody({ issues: [] }));
    vi.spyOn(globalThis, "fetch").mockImplementation(fetch);

    const result = await createHostedAdapter("openrouter").execute({
      ...executeRequest("openrouter"),
      resolveCredential: async () => TEST_CREDENTIAL,
    });

    expect(result.receipt.outcome).toBe("completed");
    const body = requestBodyAt(fetch, 0);
    expect(body.reasoning).toEqual({ max_tokens: 2048 });
    expect(body.provider).toEqual({ require_parameters: true });
    expect(body.response_format).toMatchObject({ type: "json_schema" });
  });

  it("bounds reasoning spend on the degraded path too", async () => {
    readCachedLiveModelListMock.mockReturnValue(liveList(false, true));
    const fetch = mockFetchResponse(openAiSuccessBody({ issues: [] }));
    vi.spyOn(globalThis, "fetch").mockImplementation(fetch);

    const result = await createHostedAdapter("openrouter").execute({
      ...executeRequest("openrouter"),
      resolveCredential: async () => TEST_CREDENTIAL,
    });

    expect(result.receipt.outcome).toBe("completed");
    const body = requestBodyAt(fetch, 0);
    expect(body.reasoning).toEqual({ max_tokens: 2048 });
    expect(body.response_format).toEqual({ type: "json_object" });
  });

  it("sends no reasoning control to a route that never declared it", async () => {
    readCachedLiveModelListMock.mockReturnValue(liveList(true, false));
    const fetch = mockFetchResponse(openAiSuccessBody({ issues: [] }));
    vi.spyOn(globalThis, "fetch").mockImplementation(fetch);

    const result = await createHostedAdapter("openrouter").execute({
      ...executeRequest("openrouter"),
      resolveCredential: async () => TEST_CREDENTIAL,
    });

    expect(result.receipt.outcome).toBe("completed");
    // require_parameters travels with the strict schema: an undeclared control
    // would exclude the model's own routes from routing.
    expect(requestBodyAt(fetch, 0).reasoning).toBeUndefined();
  });

  it("never consults the live list for a non-aggregator product", async () => {
    const fetch = mockFetchResponse(googleSuccessBody({ issues: [] }));
    vi.spyOn(globalThis, "fetch").mockImplementation(fetch);

    const result = await createHostedAdapter("gemini").execute({
      ...executeRequest("gemini"),
      resolveCredential: async () => TEST_CREDENTIAL,
    });

    expect(result.receipt.outcome).toBe("completed");
    expect(readCachedLiveModelListMock).not.toHaveBeenCalled();
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

  it("fails closed without resolving credentials for a mismatched evidence key", async () => {
    const resolveCredential = vi.fn(async () => TEST_CREDENTIAL);
    const adapter = createHostedAdapter("gemini");
    const result = await adapter.execute({
      ...executeRequest("gemini"),
      evidenceKey: evidenceKeyFor("zai"),
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
