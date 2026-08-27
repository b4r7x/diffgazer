import { makeIssue } from "@diffgazer/core/testing/factories";
import { afterEach, describe, expect, it, vi } from "vitest";
import { executeHostedReview } from "./execute.js";
import {
  executeRequest,
  type FetchFn,
  hostedContext,
  limits,
  type MockFetchFn,
  mockFetchResponse,
  openAiSuccessBody,
  TEST_CREDENTIAL,
} from "./execute.test-support.js";

describe("openrouter free-pool rate limiting", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("honors Retry-After on a 429 and completes on the delayed retry within the deadline", async () => {
    vi.useFakeTimers();
    let calls = 0;
    const fetch = vi.fn(async () => {
      calls += 1;
      if (calls === 1) {
        return new Response(JSON.stringify({ error: "rate limited" }), {
          status: 429,
          headers: { "content-type": "application/json", "retry-after": "5" },
        });
      }
      return new Response(JSON.stringify(openAiSuccessBody({ issues: [makeIssue()] })), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }) as FetchFn;

    const pending = executeHostedReview({
      ...executeRequest("openrouter"),
      context: hostedContext(fetch),
    });
    await vi.advanceTimersByTimeAsync(5_000);
    const result = await pending;

    expect(fetch).toHaveBeenCalledTimes(2);
    expect(result.receipt.outcome).toBe("completed");
    expect(result.result.issues).toHaveLength(1);
  });
});

describe("failure outcomes emit zero findings without fallback", () => {
  it("returns schema-failed for malformed JSON content", async () => {
    const fetch = mockFetchResponse({
      choices: [{ message: { content: "not-json" }, finish_reason: "stop" }],
      usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
    });

    const result = await executeHostedReview({
      ...executeRequest("openrouter"),
      context: hostedContext(fetch),
    });

    expect(result.receipt.outcome).toBe("schema-failed");
    expect(result.result.issues).toEqual([]);
  });

  it("returns transport-failed for oversized responses", async () => {
    const huge = "x".repeat(2_048);
    const fetch = mockFetchResponse(openAiSuccessBody({ issues: [], filler: huge }));

    const result = await executeHostedReview({
      ...executeRequest("openrouter", {
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
      ...executeRequest("openrouter"),
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
      ...executeRequest("openrouter"),
      context: hostedContext(fetch),
    });

    expect(result.receipt.outcome).toBe("transport-failed");
    expect(result.result.issues).toEqual([]);
  });

  it("returns transport-failed for rate-limited upstream responses", async () => {
    const fetch = mockFetchResponse({ error: "rate limited" }, { status: 429 });

    const result = await executeHostedReview({
      ...executeRequest("openrouter"),
      context: hostedContext(fetch),
    });

    expect(result.receipt.outcome).toBe("transport-failed");
    expect(result.result.issues).toEqual([]);
  });

  it.each([
    [401, "OpenRouter rejected the credential (HTTP 401)."],
    [403, "OpenRouter refused access (HTTP 403)."],
    [402, "OpenRouter reported billing or quota exhausted (HTTP 402)."],
    [404, "OpenRouter could not find the selected model or endpoint (HTTP 404)."],
    [413, "OpenRouter rejected the request as too large (HTTP 413)."],
    [429, "OpenRouter rate limited the request (HTTP 429)."],
  ])("reports a refused HTTP %s response as a provider rejection the user can fix", async (status, message) => {
    const fetch = mockFetchResponse({ error: "sk-secret-abcdefghijklmnop" }, { status });
    const reportDiagnostic = vi.fn();

    const result = await executeHostedReview({
      ...executeRequest("openrouter"),
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
      ...executeRequest("openrouter"),
      reportDiagnostic,
      context: hostedContext(fetch),
    });

    expect(reportDiagnostic).toHaveBeenCalledWith(
      expect.objectContaining({
        code: "transport-failed",
        retryable: true,
        safeMessage: "OpenRouter returned HTTP 503.",
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
      ...executeRequest("openrouter", { limits: { ...limits, wallTimeMs: 50 } }),
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
      ...executeRequest("openrouter"),
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
      ...executeRequest("openrouter", { limits: { ...limits, maxInputTokens: 1 } }),
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

    vi.useFakeTimers();
    try {
      const pending = executeHostedReview({
        ...executeRequest("openrouter"),
        context: hostedContext(fetch),
      });
      await vi.advanceTimersByTimeAsync(10_000);
      const result = await pending;

      expect(result.receipt.outcome).toBe("transport-failed");
      // The capped read runs once per rate-limit attempt (two retries + the
      // final diagnostic capture), never buffering a whole body.
      expect(pulledChunks).toBeLessThanOrEqual(48);
    } finally {
      vi.useRealTimers();
    }
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
