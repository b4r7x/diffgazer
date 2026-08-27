import { makeIssue } from "@diffgazer/core/testing/factories";
import { describe, expect, it, vi } from "vitest";
import { executeHostedReview } from "./execute.js";
import {
  executeRequest,
  type FetchFn,
  hostedContext,
  limits,
  type MockFetchFn,
  mockFetchResponse,
  openAiSuccessBody,
  requestBodyAt,
} from "./execute.test-support.js";

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
    // Enough for the prompt plus the corrective-retry turns, which now count
    // into the retry's input reservation.
    const retryLimits = { ...limits, maxInputTokens: 200 } as const;
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
      ...executeRequest("openrouter"),
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
      ...executeRequest("openrouter"),
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
