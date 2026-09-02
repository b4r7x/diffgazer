import { PRODUCT_REGISTRY } from "@diffgazer/core/providers";
import type { EvidenceKey } from "@diffgazer/core/schemas/review";
import { makeIssue } from "@diffgazer/core/testing/factories";
import { afterEach, describe, expect, it, vi } from "vitest";
import { log } from "../../../log.js";
import { MALFORMED_AFTER_CORRECTION_DIAGNOSTIC_CODE } from "../../diagnostics.js";
import { executeHostedReview } from "./execute.js";

vi.mock("../../../log.js", () => ({ log: vi.fn() }));

afterEach(() => {
  vi.mocked(log).mockClear();
});

import { DEFAULT_HOSTED_REVIEW_SCHEMA } from "./transport.js";

type FetchFn = typeof globalThis.fetch;
type HostedEvidenceKey = Extract<EvidenceKey, { transportFamily: "hosted-api" }>;

const TEST_CREDENTIAL = "sk-test-hosted-credential-value";

const limits = {
  maxInputTokens: 20_000,
  maxResponseBytes: 1_048_576,
  wallTimeMs: 120_000,
  maxRetries: 2,
  maxConcurrency: 1,
  maxCostUsd: 0.5,
} as const;

function evidenceKeyFor(productId: "zai" | "gemini"): HostedEvidenceKey {
  const product = PRODUCT_REGISTRY[productId];
  return {
    authentication: null,
    credentialReferenceIdentity: "3".repeat(64),
    installationId: null,
    productId,
    transportFamily: "hosted-api",
    normalizedEndpoint:
      product.configuration.endpoints[0]?.endpoint ?? "https://example.invalid/v1",
    region: null,
    workspaceAccountReference: null,
    modelId: productId === "gemini" ? "gemini-2.5-flash" : "glm-5.2",
    runtime: { identity: "diffgazer-server", version: "1.2.3" },
    structuredOutputSchemaSha256: "1".repeat(64),
    noticeVersion: product.notice.noticeVersion,
    limits,
  };
}

function mockFetchResponse(body: unknown): FetchFn {
  return vi.fn(
    async () =>
      new Response(JSON.stringify(body), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
  ) as FetchFn;
}

function trapRequest(productId: "zai" | "gemini", fetch: FetchFn) {
  return {
    configurationId: "configuration-1",
    configurationRevision: 3,
    evidenceKey: evidenceKeyFor(productId),
    prompt: "review this diff",
    context: {
      credential: TEST_CREDENTIAL,
      reviewSchema: DEFAULT_HOSTED_REVIEW_SCHEMA,
      structuredOutputSchema: { type: "object" },
      fetch,
    },
  };
}

// Measured trap shape (single probe, 2026-08-25): glm-5.2 under a completion
// cap spent the whole output budget on reasoning and returned zero content
// with finish_reason "length".
const ZAI_TRAP_BODY = {
  choices: [{ message: { content: "" }, finish_reason: "length" }],
  usage: {
    prompt_tokens: 12_000,
    completion_tokens: 4000,
    total_tokens: 16_000,
    completion_tokens_details: { reasoning_tokens: 4000 },
  },
};

describe("reasoning-budget trap", () => {
  it("fails schema-failed with a dedicated diagnostic naming the reasoning-token count", async () => {
    const fetch = mockFetchResponse(ZAI_TRAP_BODY);
    const reportDiagnostic = vi.fn();

    const result = await executeHostedReview({
      ...trapRequest("zai", fetch),
      reportDiagnostic,
    });

    expect(result.receipt.outcome).toBe("schema-failed");
    expect(reportDiagnostic).toHaveBeenCalledTimes(1);
    expect(reportDiagnostic).toHaveBeenCalledWith(
      expect.objectContaining({
        code: "reasoning-budget-consumed",
        safeMessage: expect.stringContaining("4000 reasoning tokens"),
      }),
    );
    expect(reportDiagnostic.mock.calls[0]?.[0].safeMessage).toContain('"length"');
  });

  it("does not spend a malformed-output retry on the trap", async () => {
    const fetch = mockFetchResponse(ZAI_TRAP_BODY);

    await executeHostedReview(trapRequest("zai", fetch));

    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("traps a google-wire MAX_TOKENS answer with only thought tokens", async () => {
    const fetch = mockFetchResponse({
      candidates: [{ finishReason: "MAX_TOKENS" }],
      usageMetadata: { promptTokenCount: 12, thoughtsTokenCount: 900, totalTokenCount: 912 },
    });
    const reportDiagnostic = vi.fn();

    const result = await executeHostedReview({
      ...trapRequest("gemini", fetch),
      reportDiagnostic,
    });

    expect(result.receipt.outcome).toBe("schema-failed");
    expect(reportDiagnostic).toHaveBeenCalledWith(
      expect.objectContaining({ code: "reasoning-budget-consumed" }),
    );
  });

  it("traps empty content beside spent reasoning even when the finish reason claims stop", async () => {
    // Field shape (openrouter nemotron, run b18b8cc1): every output token went
    // to reasoning, content came back empty, and finish_reason was NOT length.
    const fetch = mockFetchResponse({
      choices: [{ message: { content: "" }, finish_reason: "stop" }],
      usage: {
        prompt_tokens: 1200,
        completion_tokens: 10161,
        total_tokens: 11361,
        completion_tokens_details: { reasoning_tokens: 10161 },
      },
    });
    const reportDiagnostic = vi.fn();

    const result = await executeHostedReview({
      ...trapRequest("zai", fetch),
      reportDiagnostic,
    });

    expect(result.receipt.outcome).toBe("schema-failed");
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(reportDiagnostic).toHaveBeenCalledWith(
      expect.objectContaining({
        code: "reasoning-budget-consumed",
        safeMessage: expect.stringContaining("10161 reasoning tokens"),
      }),
    );
  });

  it("keeps the plain retry flow for empty content without reasoning tokens, then names the empty answer as a transport failure", async () => {
    const fetch = mockFetchResponse({
      choices: [{ message: { content: "" }, finish_reason: "stop" }],
      usage: { prompt_tokens: 12, completion_tokens: 0, total_tokens: 12 },
    });
    const reportDiagnostic = vi.fn();

    const result = await executeHostedReview({
      ...trapRequest("zai", fetch),
      reportDiagnostic,
    });

    expect(result.receipt.outcome).toBe("transport-failed");
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(reportDiagnostic).toHaveBeenCalledTimes(1);
    expect(reportDiagnostic).toHaveBeenCalledWith(
      expect.objectContaining({ code: "empty-content" }),
    );
  });
});

const VALID_REVIEW_CONTENT = JSON.stringify({ issues: [] });

function contentResponse(
  content: string,
  finish: { finish_reason?: string; native_finish_reason?: string } = { finish_reason: "stop" },
): Response {
  return new Response(
    JSON.stringify({
      choices: [{ message: { content }, ...finish }],
      usage: { prompt_tokens: 12, completion_tokens: 8, total_tokens: 20 },
    }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
}

function requestBodyAt(fetch: ReturnType<typeof vi.fn>, index: number): Record<string, unknown> {
  const init = fetch.mock.calls[index]?.[1] as RequestInit;
  return JSON.parse(init.body as string) as Record<string, unknown>;
}

describe("output recovery ladder", () => {
  it("completes when valid lens JSON arrives wrapped in a markdown fence", async () => {
    const fetch = vi.fn(async () =>
      contentResponse(`\`\`\`json\n${VALID_REVIEW_CONTENT}\n\`\`\``),
    ) as unknown as FetchFn;

    const result = await executeHostedReview(trapRequest("zai", fetch));

    expect(result.receipt.outcome).toBe("completed");
    expect(result.receipt.attemptCount).toBe(1);
  });

  it("completes when valid lens JSON arrives inside prose", async () => {
    const fetch = vi.fn(async () =>
      contentResponse(`Here is the review:\n${VALID_REVIEW_CONTENT}\nHope that helps!`),
    ) as unknown as FetchFn;

    const result = await executeHostedReview(trapRequest("zai", fetch));

    expect(result.receipt.outcome).toBe("completed");
    expect(result.receipt.attemptCount).toBe(1);
  });

  it("names truncation on finish=length without spending a retry", async () => {
    const truncated = VALID_REVIEW_CONTENT.slice(0, 10);
    const fetch = vi.fn(async () =>
      contentResponse(truncated, { finish_reason: "length" }),
    ) as unknown as FetchFn;
    const reportDiagnostic = vi.fn();

    const result = await executeHostedReview({ ...trapRequest("zai", fetch), reportDiagnostic });

    expect(result.receipt.outcome).toBe("schema-failed");
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(reportDiagnostic).toHaveBeenCalledTimes(1);
    expect(reportDiagnostic).toHaveBeenCalledWith(
      expect.objectContaining({
        code: "output-truncated",
        retryable: false,
        remediation: expect.stringContaining("completion limit"),
      }),
    );
  });

  it("reads native_finish_reason as a fallback length signal", async () => {
    const fetch = vi.fn(async () =>
      contentResponse('{"issues":[{"id":"cut', {
        finish_reason: "stop",
        native_finish_reason: "MAX_TOKENS",
      }),
    ) as unknown as FetchFn;
    const reportDiagnostic = vi.fn();

    const result = await executeHostedReview({ ...trapRequest("zai", fetch), reportDiagnostic });

    expect(result.receipt.outcome).toBe("schema-failed");
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(reportDiagnostic).toHaveBeenCalledWith(
      expect.objectContaining({ code: "output-truncated" }),
    );
  });

  it("retries schema-invalid output with the failed answer and issue paths as turns", async () => {
    const invalidContent = JSON.stringify({ issues: "not-an-array" });
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(contentResponse(invalidContent))
      .mockResolvedValueOnce(contentResponse(VALID_REVIEW_CONTENT)) as unknown as FetchFn;

    const result = await executeHostedReview(trapRequest("zai", fetch));

    expect(result.receipt.outcome).toBe("completed");
    expect(result.receipt.attemptCount).toBe(2);
    const retryMessages = requestBodyAt(fetch as ReturnType<typeof vi.fn>, 1).messages as Array<
      Record<string, string>
    >;
    expect(retryMessages).toEqual([
      { role: "user", content: "review this diff" },
      { role: "assistant", content: invalidContent },
      {
        role: "user",
        content: expect.stringContaining("issues"),
      },
    ]);
    expect(retryMessages[2]?.content).toContain("ONLY the corrected JSON object");
    // The first attempt carries no correction turns.
    expect(requestBodyAt(fetch as ReturnType<typeof vi.fn>, 0).messages).toHaveLength(1);
  });

  it("retries unparseable output with a corrective instruction", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(contentResponse("not-json"))
      .mockResolvedValueOnce(contentResponse(VALID_REVIEW_CONTENT)) as unknown as FetchFn;

    const result = await executeHostedReview(trapRequest("zai", fetch));

    expect(result.receipt.outcome).toBe("completed");
    expect(result.receipt.attemptCount).toBe(2);
    const retryMessages = requestBodyAt(fetch as ReturnType<typeof vi.fn>, 1).messages as Array<
      Record<string, string>
    >;
    expect(retryMessages[1]).toEqual({ role: "assistant", content: "not-json" });
    expect(retryMessages[2]?.content).toContain("not valid");
  });

  it("captures the malformed answer and issue paths when the corrective retry also fails", async () => {
    const invalidContent = JSON.stringify({ issues: "still-not-an-array" });
    const fetch = vi.fn(async () => contentResponse(invalidContent)) as unknown as FetchFn;
    const reportDiagnostic = vi.fn();

    const result = await executeHostedReview({ ...trapRequest("zai", fetch), reportDiagnostic });

    expect(result.receipt.outcome).toBe("schema-failed");
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(reportDiagnostic).toHaveBeenCalledTimes(1);
    expect(reportDiagnostic).toHaveBeenCalledWith(
      expect.objectContaining({
        code: MALFORMED_AFTER_CORRECTION_DIAGNOSTIC_CODE,
        safeMessage: expect.stringContaining("schema validation"),
        truncatedDetails: expect.stringContaining("still-not-an-array"),
      }),
    );
    expect(reportDiagnostic.mock.calls[0]?.[0].truncatedDetails).toContain("invalid-paths");
    expect(reportDiagnostic.mock.calls[0]?.[0].truncatedDetails).toContain("issues");
    // The capture must also land in the server log: downstream diagnostics
    // drop truncatedDetails, so the log line is the fixture's only sink.
    expect(vi.mocked(log)).toHaveBeenCalledWith(
      "warn",
      "hosted_malformed_output",
      expect.objectContaining({
        code: MALFORMED_AFTER_CORRECTION_DIAGNOSTIC_CODE,
        details: expect.stringContaining("still-not-an-array"),
      }),
    );
  });

  it("captures unparseable output that stays unrecoverable after the retry", async () => {
    const fetch = vi.fn(async () => contentResponse("not-json")) as unknown as FetchFn;
    const reportDiagnostic = vi.fn();

    const result = await executeHostedReview({ ...trapRequest("zai", fetch), reportDiagnostic });

    expect(result.receipt.outcome).toBe("schema-failed");
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(reportDiagnostic).toHaveBeenCalledTimes(1);
    expect(reportDiagnostic).toHaveBeenCalledWith(
      expect.objectContaining({
        code: MALFORMED_AFTER_CORRECTION_DIAGNOSTIC_CODE,
        safeMessage: expect.stringContaining("JSON parsing"),
        truncatedDetails: expect.stringContaining("not-json"),
      }),
    );
  });
});

describe("per-issue salvage", () => {
  const validIssue = makeIssue({ id: "salvaged-1" });
  const mixedContent = JSON.stringify({ issues: [validIssue, { id: "broken" }] });

  it("completes with the issues that validate when the corrected answer is still invalid", async () => {
    const fetch = vi.fn(async () => contentResponse(mixedContent)) as unknown as FetchFn;
    const reportDiagnostic = vi.fn();

    const result = await executeHostedReview({ ...trapRequest("zai", fetch), reportDiagnostic });

    expect(result.receipt.outcome).toBe("completed");
    expect(result.result.issues).toEqual([validIssue]);
    // Salvage is the last tier: the corrective retry ran first.
    expect(fetch).toHaveBeenCalledTimes(2);
    // The kept findings are not a whole lens: the user is told what the answer cost.
    expect(reportDiagnostic).toHaveBeenCalledWith(
      expect.objectContaining({
        code: "output-salvaged",
        retryable: false,
        safeMessage: expect.stringContaining("1 finding(s) were salvaged and 1 candidate(s)"),
        salvage: { keptFindingCount: 1, droppedCandidateCount: 1 },
      }),
    );
    expect(vi.mocked(log)).toHaveBeenCalledWith(
      "warn",
      "hosted_salvaged_output",
      expect.objectContaining({
        keptCount: 1,
        droppedCount: 1,
        // The salvage line carries a correlation id like its sibling failure logs.
        correlationId: expect.any(String),
      }),
    );
  });

  it("keeps the complete findings of a truncated answer without spending a retry", async () => {
    const truncated = `{"issues":[${JSON.stringify(validIssue)},{"id":"cut`;
    const fetch = vi.fn(async () =>
      contentResponse(truncated, { finish_reason: "length" }),
    ) as unknown as FetchFn;
    const reportDiagnostic = vi.fn();

    const result = await executeHostedReview({ ...trapRequest("zai", fetch), reportDiagnostic });

    expect(result.receipt.outcome).toBe("completed");
    expect(result.result.issues).toEqual([validIssue]);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(reportDiagnostic).toHaveBeenCalledWith(
      expect.objectContaining({
        code: "output-salvaged",
        retryable: false,
        safeMessage: expect.stringContaining("incomplete"),
      }),
    );
  });

  it("salvages for a strict-json-schema product too", async () => {
    const fetch = mockFetchResponse({
      candidates: [{ content: { parts: [{ text: mixedContent }] }, finishReason: "STOP" }],
      usageMetadata: { promptTokenCount: 12, candidatesTokenCount: 8, totalTokenCount: 20 },
    });

    const result = await executeHostedReview(trapRequest("gemini", fetch));

    expect(result.receipt.outcome).toBe("completed");
    expect(result.result.issues).toEqual([validIssue]);
    // The gemini profile allows no corrective retry, so salvage is all there is.
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("leaves the corrected answer alone when the retry fixes the output", async () => {
    const corrected = JSON.stringify({ issues: [validIssue, makeIssue({ id: "salvaged-2" })] });
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(contentResponse(mixedContent))
      .mockResolvedValueOnce(contentResponse(corrected)) as unknown as FetchFn;

    const result = await executeHostedReview(trapRequest("zai", fetch));

    expect(result.receipt.outcome).toBe("completed");
    expect(result.result.issues).toHaveLength(2);
    expect(vi.mocked(log)).not.toHaveBeenCalledWith(
      "warn",
      "hosted_salvaged_output",
      expect.anything(),
    );
  });
});

describe("upstream mid-generation failure (finish error / choice error)", () => {
  // Field shape (OpenRouter errors docs): the upstream provider died
  // mid-generation, so the error object rides on the final choice beside any
  // partial content, and finish_reason is "error".
  const finishErrorBody = (content: string, error?: Record<string, unknown>) => ({
    choices: [{ message: { content }, finish_reason: "error", ...(error ? { error } : {}) }],
    usage: {
      prompt_tokens: 1200,
      completion_tokens: 10352,
      total_tokens: 11552,
      completion_tokens_details: { reasoning_tokens: 10352 },
    },
  });

  it("classifies empty content with finish error as retryable transport, never the reasoning trap", async () => {
    const fetch = mockFetchResponse(finishErrorBody(""));
    const reportDiagnostic = vi.fn();

    const result = await executeHostedReview({ ...trapRequest("zai", fetch), reportDiagnostic });

    expect(result.receipt.outcome).toBe("transport-failed");
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(reportDiagnostic).toHaveBeenCalledWith(
      expect.objectContaining({ code: "provider-generation-error", retryable: true }),
    );
    expect(reportDiagnostic).not.toHaveBeenCalledWith(
      expect.objectContaining({ code: "reasoning-budget-consumed" }),
    );
  });

  it("retries a choice-level error blind and captures the provider message with the content head", async () => {
    const fetch = mockFetchResponse({
      choices: [
        {
          message: { content: '{"issues":[{"partial' },
          finish_reason: "stop",
          error: {
            code: 502,
            message: "Provider disconnected mid-stream",
            metadata: { error_type: "provider_unavailable" },
          },
        },
      ],
      usage: { prompt_tokens: 12, completion_tokens: 8, total_tokens: 20 },
    });
    const reportDiagnostic = vi.fn();

    const result = await executeHostedReview({ ...trapRequest("zai", fetch), reportDiagnostic });

    expect(result.receipt.outcome).toBe("transport-failed");
    expect(fetch).toHaveBeenCalledTimes(2);
    // Blind retry: the model's answer is not the fault, so the second request
    // repeats the original prompt with no correction turns.
    expect(requestBodyAt(fetch as ReturnType<typeof vi.fn>, 1).messages).toHaveLength(1);
    expect(reportDiagnostic).toHaveBeenCalledWith(
      expect.objectContaining({
        code: "provider-generation-error",
        safeMessage: expect.stringContaining("Provider disconnected mid-stream"),
        remediation: expect.stringContaining("different provider"),
        truncatedDetails: expect.stringContaining('{"issues":[{"partial'),
      }),
    );
    // The fixture must also survive in the server log, like malformed output.
    expect(vi.mocked(log)).toHaveBeenCalledWith(
      "warn",
      "hosted_provider_generation_error",
      expect.objectContaining({ code: "provider-generation-error" }),
    );
  });
});

describe("wall-time deadline diagnostic", () => {
  const abortingFetch = () =>
    vi.fn(
      (_url: unknown, init?: RequestInit) =>
        new Promise<Response>((_, reject) => {
          init?.signal?.addEventListener("abort", () => reject(init.signal?.reason));
        }),
    ) as unknown as FetchFn;

  const timeOutDispatch = async (productId: "zai" | "gemini", reportDiagnostic: () => void) => {
    const request = trapRequest(productId, abortingFetch());
    return executeHostedReview({
      ...request,
      evidenceKey: { ...request.evidenceKey, limits: { ...limits, wallTimeMs: 25 } },
      reportDiagnostic,
    });
  };

  it("names elapsed versus limit, without the budget knob a pinned product overrides", async () => {
    const reportDiagnostic = vi.fn();

    const result = await timeOutDispatch("zai", reportDiagnostic);

    expect(result.receipt.outcome).toBe("timed-out");
    expect(reportDiagnostic).toHaveBeenCalledTimes(1);
    expect(reportDiagnostic).toHaveBeenCalledWith(
      expect.objectContaining({
        code: "timed-out",
        retryable: true,
        safeMessage: expect.stringContaining("wall-time limit"),
        // The zai dispatch profile pins the per-dispatch wall, so the
        // configured budget wall cannot move this deadline.
        remediation: expect.not.stringContaining("wall-time budget"),
      }),
    );
  });

  it("still offers the budget knob on a product whose wall is not pinned", async () => {
    const reportDiagnostic = vi.fn();

    await timeOutDispatch("gemini", reportDiagnostic);

    expect(reportDiagnostic).toHaveBeenCalledWith(
      expect.objectContaining({
        code: "timed-out",
        remediation: expect.stringContaining("raise the wall-time budget"),
      }),
    );
  });

  const transportTimeout = () =>
    new TypeError("fetch failed", {
      cause: Object.assign(new Error("Headers Timeout Error"), {
        code: "UND_ERR_HEADERS_TIMEOUT",
      }),
    });

  it("re-dispatches once after a client response timeout while the wall still fits an answer", async () => {
    const fetch = vi
      .fn()
      .mockRejectedValueOnce(transportTimeout())
      .mockResolvedValueOnce(contentResponse(VALID_REVIEW_CONTENT)) as unknown as FetchFn;
    const reportDiagnostic = vi.fn();

    const result = await executeHostedReview({ ...trapRequest("zai", fetch), reportDiagnostic });

    expect(result.receipt.outcome).toBe("completed");
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(result.receipt.attemptCount).toBe(2);
    expect(reportDiagnostic).not.toHaveBeenCalled();
  });

  it("re-dispatches at most once, then reports the timeout", async () => {
    const fetch = vi.fn(async () => {
      throw transportTimeout();
    }) as unknown as FetchFn;
    const reportDiagnostic = vi.fn();

    const result = await executeHostedReview({ ...trapRequest("zai", fetch), reportDiagnostic });

    expect(result.receipt.outcome).toBe("timed-out");
    expect(fetch).toHaveBeenCalledTimes(2);
    // Node's fetch caps a silent response at its default headers/body timeout
    // regardless of the dispatch wall, and reports it as a generic
    // "fetch failed" whose cause carries the undici code the diagnostic names.
    expect(reportDiagnostic).toHaveBeenCalledWith(
      expect.objectContaining({
        code: "timed-out",
        retryable: true,
        safeMessage: expect.stringContaining("UND_ERR_HEADERS_TIMEOUT"),
      }),
    );
  });

  it("does not re-dispatch when the remaining wall cannot fit a whole answer", async () => {
    const fetch = vi.fn(async () => {
      throw transportTimeout();
    }) as unknown as FetchFn;
    const request = trapRequest("zai", fetch);

    const result = await executeHostedReview({
      ...request,
      evidenceKey: { ...request.evidenceKey, limits: { ...limits, wallTimeMs: 30_000 } },
    });

    expect(result.receipt.outcome).toBe("timed-out");
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});

function rateLimitResponse(headers: Record<string, string> = {}, code = "1302"): Response {
  return new Response(JSON.stringify({ error: { code, message: "rate limited" } }), {
    status: 429,
    headers: { "content-type": "application/json", ...headers },
  });
}

function sequenceFetch(factories: Array<() => Response>): FetchFn {
  let call = 0;
  return vi.fn(async () => {
    const factory = factories[Math.min(call, factories.length - 1)];
    call += 1;
    return factory?.() as Response;
  }) as FetchFn;
}

describe("rate-limit retry", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("retries a 429 after the backoff delay and continues with the next response", async () => {
    vi.useFakeTimers();
    const fetch = sequenceFetch([
      () => rateLimitResponse(),
      () =>
        new Response(JSON.stringify(ZAI_TRAP_BODY), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    ]);

    const pending = executeHostedReview(trapRequest("zai", fetch));
    await vi.advanceTimersByTimeAsync(2_000);
    const result = await pending;

    expect(fetch).toHaveBeenCalledTimes(2);
    expect(result.receipt.outcome).toBe("schema-failed");
  });

  it("tells the stream it is backing off instead of waiting silently", async () => {
    vi.useFakeTimers();
    const fetch = sequenceFetch([
      () => rateLimitResponse(),
      () =>
        new Response(JSON.stringify(ZAI_TRAP_BODY), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    ]);
    const reportProgress = vi.fn();

    const pending = executeHostedReview({ ...trapRequest("zai", fetch), reportProgress });
    await vi.advanceTimersByTimeAsync(2_000);
    await pending;

    expect(reportProgress).toHaveBeenCalledWith({
      message: "Rate-limited, retrying in 2s",
      holdsForMs: 2_000,
    });
  });

  it("honors a Retry-After header shorter than the default backoff", async () => {
    vi.useFakeTimers();
    const fetch = sequenceFetch([
      () => rateLimitResponse({ "retry-after": "1" }),
      () =>
        new Response(JSON.stringify(ZAI_TRAP_BODY), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    ]);

    const pending = executeHostedReview(trapRequest("zai", fetch));
    await vi.advanceTimersByTimeAsync(1_000);
    const result = await pending;

    expect(fetch).toHaveBeenCalledTimes(2);
    expect(result.receipt.outcome).toBe("schema-failed");
  });

  it("gives up after two retries with the honest sequential-mode remediation", async () => {
    vi.useFakeTimers();
    const fetch = sequenceFetch([() => rateLimitResponse()]);
    const reportDiagnostic = vi.fn();

    const pending = executeHostedReview({ ...trapRequest("zai", fetch), reportDiagnostic });
    await vi.advanceTimersByTimeAsync(2_000);
    await vi.advanceTimersByTimeAsync(8_000);
    const result = await pending;

    expect(fetch).toHaveBeenCalledTimes(3);
    expect(result.receipt.outcome).toBe("transport-failed");
    expect(reportDiagnostic).toHaveBeenCalledWith(
      expect.objectContaining({
        remediation: expect.stringContaining("Sequential"),
      }),
    );
  });

  it("reports the 429 diagnostic when the run is aborted during the backoff sleep", async () => {
    vi.useFakeTimers();
    const fetch = sequenceFetch([() => rateLimitResponse()]);
    const reportDiagnostic = vi.fn();
    const controller = new AbortController();

    const pending = executeHostedReview({
      ...trapRequest("zai", fetch),
      signal: controller.signal,
      reportDiagnostic,
    });
    await vi.advanceTimersByTimeAsync(1_000);
    controller.abort();
    const result = await pending;

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(result.receipt.outcome).toBe("cancelled");
    expect(reportDiagnostic).toHaveBeenCalledTimes(1);
    expect(reportDiagnostic).toHaveBeenCalledWith(
      expect.objectContaining({
        code: "provider-rejected",
        remediation: expect.stringContaining("Sequential"),
      }),
    );
  });

  it("does not retry a 429 carrying a non-retryable business code", async () => {
    const fetch = sequenceFetch([() => rateLimitResponse({}, "1113")]);
    const reportDiagnostic = vi.fn();

    const result = await executeHostedReview({ ...trapRequest("zai", fetch), reportDiagnostic });

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(result.receipt.outcome).toBe("transport-failed");
    expect(reportDiagnostic).toHaveBeenCalledTimes(1);
    expect(reportDiagnostic).toHaveBeenCalledWith(
      expect.objectContaining({
        retryable: false,
        remediation: expect.stringContaining("balance"),
      }),
    );
  });

  it("keeps retrying a non-zai 429 whose body carries a zai business code", async () => {
    vi.useFakeTimers();
    const fetch = sequenceFetch([() => rateLimitResponse({}, "1113")]);

    const pending = executeHostedReview(trapRequest("gemini", fetch));
    await vi.advanceTimersByTimeAsync(2_000);
    await vi.advanceTimersByTimeAsync(8_000);
    const result = await pending;

    expect(fetch).toHaveBeenCalledTimes(3);
    expect(result.receipt.outcome).toBe("transport-failed");
  });
});
