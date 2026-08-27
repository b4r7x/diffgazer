import { PRODUCT_REGISTRY } from "@diffgazer/core/providers";
import { ExecutionResultSchema } from "@diffgazer/core/schemas/review";
import { makeIssue } from "@diffgazer/core/testing/factories";
import { describe, expect, it } from "vitest";
import { executeHostedReview } from "./execute.js";
import {
  evidenceKeyFor,
  executeRequest,
  type FetchFn,
  googleSuccessBody,
  hostedContext,
  type MockFetchFn,
  mockFetchResponse,
  openAiSuccessBody,
  requestBodyAt,
  STRUCTURED_OUTPUT_SCHEMA,
  TEST_CREDENTIAL,
} from "./execute.test-support.js";

describe("existing hosted provider continuity", () => {
  it.each([
    "gemini",
    "zai",
    "openrouter",
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
      ...executeRequest("openrouter"),
      context: hostedContext(fetch),
    });

    expect(result.receipt.outcome).toBe("completed");
    expect(result.receipt.usageAvailability).toBe("unavailable");
    expect(result.receipt.usage).toBeUndefined();
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
    return requestBodyAt(fetch, 0);
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
      ...executeRequest("openrouter"),
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
      ...executeRequest("openrouter"),
      context: hostedContext(fetch),
    });

    expect(requestBody(fetch).messages).toEqual([{ role: "user", content: "review this diff" }]);
  });
});
