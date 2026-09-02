import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { log } from "../../../log.js";
import { executeHostedReview } from "./execute.js";
import {
  executeRequest,
  type FetchFn,
  hostedContext,
  limits,
  mockFetchResponse,
  openAiSuccessBody,
} from "./execute.test-support.js";
import { resolveDispatchPacing } from "./profiles.js";

vi.mock("../../../log.js", () => ({ log: vi.fn() }));
vi.mock("./profiles.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./profiles.js")>();
  return { ...actual, resolveDispatchPacing: vi.fn(actual.resolveDispatchPacing) };
});

afterEach(() => {
  vi.mocked(log).mockClear();
});

// No redaction pattern matches this shape (no `sk-`/`ghp_` prefix, no
// assignment keyword), so it survives unless the diagnostic is serialized with
// the credential as a literal secret — which is what these cases must prove.
const PLAIN_CREDENTIAL = "9f3c2a7e1b4d5c6a8e0f1a2b3c4d5e6f.Ab12Cd34Ef56Gh78";

// Every terminal exit of the dispatch loop must leave one diagnostic on the
// receipt and one warn line naming the same correlation id, or the client
// synthesizes "Adapter transport failed." / "Adapter response failed schema
// validation." from the bare outcome and the user never learns what the
// provider returned. A 2xx body that is not JSON and an empty answer with no
// reasoning spend used to file as "schema-failed", which the pipeline reports
// as model incompatibility — although nothing about the model was proven;
// live, the same model completed the same review minutes later.
async function dispatch(
  productId: "zai" | "openrouter" | "gemini",
  fetch: FetchFn,
  patch: Parameters<typeof executeRequest>[1] = {},
) {
  const reportDiagnostic = vi.fn();
  const result = await executeHostedReview({
    ...executeRequest(productId, patch),
    context: { ...hostedContext(fetch), credential: PLAIN_CREDENTIAL },
    reportDiagnostic,
  });
  return { result, reportDiagnostic };
}

function htmlResponse(): Response {
  return new Response(`<html>Bad gateway ${PLAIN_CREDENTIAL}</html>`, {
    status: 200,
    headers: { "content-type": "text/html" },
  });
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

function sequenceFetch(factories: Array<() => Response>): FetchFn {
  let call = 0;
  return vi.fn(async () => {
    const factory = factories[Math.min(call, factories.length - 1)];
    call += 1;
    if (!factory) throw new Error("no response factory");
    return factory();
  }) as FetchFn;
}

function streamingResponse(
  start: (controller: ReadableStreamDefaultController<Uint8Array>) => void,
  cancel?: () => void,
): Response {
  return new Response(new ReadableStream<Uint8Array>({ start, cancel }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

function warnLines(event: string): Array<Record<string, unknown>> {
  return vi
    .mocked(log)
    .mock.calls.filter(([level, name]) => level === "warn" && name === event)
    .map(([, , fields]) => fields ?? {});
}

describe.each(["zai", "openrouter"] as const)("silent dispatch failures — %s", (productId) => {
  it("retries a 2xx body that is not JSON once, then reports it with its status and a bounded, scrubbed excerpt as a transport failure", async () => {
    const fetch = mockFetchResponse(`<html>Bad gateway ${PLAIN_CREDENTIAL}</html>`, {
      headers: { "content-type": "text/html" },
    });

    const { result, reportDiagnostic } = await dispatch(productId, fetch);

    expect(fetch).toHaveBeenCalledTimes(2);
    expect(result.receipt.outcome).toBe("transport-failed");
    expect(reportDiagnostic).toHaveBeenCalledTimes(1);
    expect(reportDiagnostic).toHaveBeenCalledWith(
      expect.objectContaining({
        code: "unparseable-response",
        retryable: true,
        safeMessage: expect.stringContaining("HTTP 200 with a body that is not JSON (text/html; "),
        truncatedDetails: expect.stringContaining("Bad gateway"),
      }),
    );
    expect(JSON.stringify(reportDiagnostic.mock.calls)).not.toContain(PLAIN_CREDENTIAL);
    expect(warnLines("hosted_unparseable_response_retry")).toHaveLength(1);
    expect(log).toHaveBeenCalledWith(
      "warn",
      "hosted_unparseable_response",
      expect.objectContaining({
        code: "unparseable-response",
        correlationId: reportDiagnostic.mock.calls[0]?.[0].correlationId,
        safeMessage: expect.stringContaining("HTTP 200"),
        status: 200,
        attemptCount: 2,
      }),
    );
    expect(JSON.stringify(vi.mocked(log).mock.calls)).not.toContain(PLAIN_CREDENTIAL);
  });

  it("completes when the retry after a non-JSON body answers properly, without a diagnostic", async () => {
    const fetch = sequenceFetch([
      htmlResponse,
      () => jsonResponse(openAiSuccessBody({ issues: [] })),
    ]);

    const { result, reportDiagnostic } = await dispatch(productId, fetch);

    expect(result.receipt.outcome).toBe("completed");
    expect(result.receipt.attemptCount).toBe(2);
    expect(reportDiagnostic).not.toHaveBeenCalled();
    expect(warnLines("hosted_unparseable_response_retry")).toHaveLength(1);
  });

  it("charges the discarded non-JSON body to the response envelope, so the retry cannot spend it twice", async () => {
    // The envelope admits the valid answer alone. Once the gateway page has
    // been drawn down, the same answer no longer fits and the retry stops on
    // the budget, exactly as every other outer-loop retry does.
    const answer = openAiSuccessBody({ issues: [] });
    const answerBytes = new TextEncoder().encode(JSON.stringify(answer)).byteLength;
    const fetch = sequenceFetch([htmlResponse, () => jsonResponse(answer)]);

    const { result, reportDiagnostic } = await dispatch(productId, fetch, {
      limits: { ...limits, maxResponseBytes: answerBytes + 10 },
    });

    expect(result.receipt.outcome).toBe("budget-exhausted");
    expect(reportDiagnostic).not.toHaveBeenCalled();
    expect(warnLines("hosted_unparseable_response_retry")).toHaveLength(1);
  });

  it("does not re-dispatch a non-JSON body when the remaining wall cannot fit a whole answer", async () => {
    const fetch = mockFetchResponse("<html>Bad gateway</html>", {
      headers: { "content-type": "text/html" },
    });

    const { result, reportDiagnostic } = await dispatch(productId, fetch, {
      limits: { ...limits, wallTimeMs: 30_000 },
    });

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(result.receipt.outcome).toBe("transport-failed");
    expect(reportDiagnostic).toHaveBeenCalledWith(
      expect.objectContaining({ code: "unparseable-response" }),
    );
  });

  it("reports an empty answer with no reasoning spend after the blind retry as a transport failure", async () => {
    const fetch = mockFetchResponse({
      choices: [{ message: { content: "" }, finish_reason: "stop" }],
      usage: { prompt_tokens: 12, completion_tokens: 0, total_tokens: 12 },
    });

    const { result, reportDiagnostic } = await dispatch(productId, fetch);

    expect(fetch).toHaveBeenCalledTimes(2);
    expect(result.receipt.outcome).toBe("transport-failed");
    expect(reportDiagnostic).toHaveBeenCalledTimes(1);
    expect(reportDiagnostic).toHaveBeenCalledWith(
      expect.objectContaining({
        code: "empty-content",
        retryable: true,
        safeMessage: expect.stringContaining(
          'empty answer (finish reason "stop", no reasoning tokens reported) after 2 attempt(s)',
        ),
      }),
    );
    expect(log).toHaveBeenCalledWith(
      "warn",
      "hosted_empty_content",
      expect.objectContaining({
        code: "empty-content",
        correlationId: reportDiagnostic.mock.calls[0]?.[0].correlationId,
        safeMessage: expect.stringContaining("empty answer"),
        attemptCount: 2,
      }),
    );
  });

  it("reports a fetch that throws a plain network error, naming the cause code and scrubbing the cause text", async () => {
    // Node's fetch surfaces a socket failure as a generic TypeError whose cause
    // carries the code — the same shape the transport-timeout path already reads.
    const fetch = vi.fn(async () => {
      throw new TypeError("fetch failed", {
        cause: Object.assign(new Error(`read ECONNRESET ${PLAIN_CREDENTIAL}`), {
          code: "ECONNRESET",
        }),
      });
    }) as FetchFn;

    const { result, reportDiagnostic } = await dispatch(productId, fetch);

    expect(result.receipt.outcome).toBe("transport-failed");
    expect(reportDiagnostic).toHaveBeenCalledTimes(1);
    expect(reportDiagnostic).toHaveBeenCalledWith(
      expect.objectContaining({
        code: "fetch-failed",
        retryable: true,
        safeMessage: expect.stringContaining("ECONNRESET"),
        truncatedDetails: expect.stringContaining("fetch failed: Error: read ECONNRESET"),
      }),
    );
    expect(log).toHaveBeenCalledWith(
      "warn",
      "hosted_fetch_failed",
      expect.objectContaining({
        code: "fetch-failed",
        correlationId: reportDiagnostic.mock.calls[0]?.[0].correlationId,
        safeMessage: expect.stringContaining("ECONNRESET"),
        attemptCount: 1,
      }),
    );
    expect(JSON.stringify(reportDiagnostic.mock.calls)).not.toContain(PLAIN_CREDENTIAL);
    expect(JSON.stringify(vi.mocked(log).mock.calls)).not.toContain(PLAIN_CREDENTIAL);
  });

  it("files a wall expiry during the body read as timed-out with the wall diagnostic", async () => {
    const fetch: FetchFn = async (_url, init) =>
      streamingResponse((controller) => {
        init?.signal?.addEventListener("abort", () => controller.error(init.signal?.reason));
      });

    const { result, reportDiagnostic } = await dispatch(productId, fetch, {
      limits: { ...limits, wallTimeMs: 50 },
    });

    expect(result.receipt.outcome).toBe("timed-out");
    expect(reportDiagnostic).toHaveBeenCalledTimes(1);
    expect(reportDiagnostic).toHaveBeenCalledWith(
      expect.objectContaining({
        code: "timed-out",
        safeMessage: expect.stringContaining("wall-time limit"),
      }),
    );
  });

  it("settles a caller cancel during the body read as cancelled without a diagnostic", async () => {
    const controller = new AbortController();
    const fetch: FetchFn = async (_url, init) =>
      streamingResponse((stream) => {
        init?.signal?.addEventListener("abort", () => stream.error(init.signal?.reason));
        setTimeout(() => controller.abort(), 0);
      });

    const reportDiagnostic = vi.fn();
    const result = await executeHostedReview({
      ...executeRequest(productId),
      signal: controller.signal,
      context: hostedContext(fetch),
      reportDiagnostic,
    });

    expect(result.receipt.outcome).toBe("cancelled");
    expect(reportDiagnostic).not.toHaveBeenCalled();
    expect(warnLines("hosted_response_read_failed")).toHaveLength(0);
  });

  it("reports a body stream that dies mid-read with the deadline alive as a transport failure", async () => {
    const fetch: FetchFn = async () =>
      streamingResponse((controller) => {
        controller.enqueue(new TextEncoder().encode('{"choices":['));
        controller.error(new Error("other side closed"));
      });

    const { result, reportDiagnostic } = await dispatch(productId, fetch);

    expect(result.receipt.outcome).toBe("transport-failed");
    expect(reportDiagnostic).toHaveBeenCalledTimes(1);
    expect(reportDiagnostic).toHaveBeenCalledWith(
      expect.objectContaining({
        code: "response-read-failed",
        retryable: true,
        safeMessage: expect.stringContaining("other side closed"),
      }),
    );
    expect(log).toHaveBeenCalledWith(
      "warn",
      "hosted_response_read_failed",
      expect.objectContaining({ code: "response-read-failed", attemptCount: 1 }),
    );
  });

  it("reports an oversized body on the first attempt as a non-retryable transport failure", async () => {
    const fetch = mockFetchResponse(openAiSuccessBody({ issues: [], filler: "x".repeat(2_048) }));

    const { result, reportDiagnostic } = await dispatch(productId, fetch, {
      limits: { ...limits, maxResponseBytes: 256 },
    });

    expect(result.receipt.outcome).toBe("transport-failed");
    expect(reportDiagnostic).toHaveBeenCalledTimes(1);
    expect(reportDiagnostic).toHaveBeenCalledWith(
      expect.objectContaining({
        code: "oversize-response",
        retryable: false,
        safeMessage: expect.stringContaining("more than 256 bytes"),
      }),
    );
    expect(log).toHaveBeenCalledWith(
      "warn",
      "hosted_response_read_failed",
      expect.objectContaining({ code: "oversize-response", attemptCount: 1 }),
    );
  });
});

it("does not re-dispatch a non-JSON body for a product without the malformed-output retry", async () => {
  const fetch = mockFetchResponse("<html>Bad gateway</html>", {
    headers: { "content-type": "text/html" },
  });

  const { result, reportDiagnostic } = await dispatch("gemini", fetch);

  expect(fetch).toHaveBeenCalledTimes(1);
  expect(result.receipt.outcome).toBe("transport-failed");
  expect(reportDiagnostic).toHaveBeenCalledWith(
    expect.objectContaining({ code: "unparseable-response" }),
  );
});

// OpenRouter's non-streaming keep-alive, probed 2026-09-02: an 11-byte
// whitespace chunk every ≈420 ms for the whole generation, the answer last —
// so a stalled generation is never silent and only the reader can see it.
const KEEP_ALIVE_CHUNK = new TextEncoder().encode("\n         \n");

/**
 * A 200 whose body is keep-alive whitespace every 20 ms — forever, or until
 * `answer` lands at `answerAfterMs`. `leadingBytes` arrive first, as the
 * start of an answer that then stalls.
 */
function keepAliveResponse(
  options: { leadingBytes?: string; answerAfterMs?: number; answer?: unknown } = {},
): Response {
  let interval: ReturnType<typeof setInterval> | undefined;
  return streamingResponse(
    (controller) => {
      if (options.leadingBytes) controller.enqueue(new TextEncoder().encode(options.leadingBytes));
      interval = setInterval(() => controller.enqueue(KEEP_ALIVE_CHUNK), 20);
      if (options.answerAfterMs === undefined) return;
      setTimeout(() => {
        clearInterval(interval);
        controller.enqueue(new TextEncoder().encode(JSON.stringify(options.answer)));
        controller.close();
      }, options.answerAfterMs);
    },
    () => clearInterval(interval),
  );
}

const stalledResponse = () => keepAliveResponse();
const headersTimeout = () =>
  new TypeError("fetch failed", {
    cause: Object.assign(new Error("Headers Timeout Error"), { code: "UND_ERR_HEADERS_TIMEOUT" }),
  });
// The shape undici hands the reader when the pooled agent's body timeout fires
// after the headers (fetch: `TypeError("terminated", { cause })`).
const bodyTimeout = () =>
  new TypeError("terminated", {
    cause: Object.assign(new Error("Body Timeout Error"), { code: "UND_ERR_BODY_TIMEOUT" }),
  });

describe("answer-idle budget — openrouter", () => {
  const ANSWER_IDLE_BUDGET_MS = 200;
  const actualPacing = vi.mocked(resolveDispatchPacing).getMockImplementation();

  beforeEach(() => {
    vi.mocked(resolveDispatchPacing).mockImplementation((productId, modelId) => ({
      ...actualPacing?.(productId, modelId),
      ...(productId === "openrouter" ? { bodyIdleTimeoutMs: ANSWER_IDLE_BUDGET_MS } : {}),
    }));
  });
  afterEach(() => {
    vi.useRealTimers();
    if (actualPacing) vi.mocked(resolveDispatchPacing).mockImplementation(actualPacing);
  });

  it("re-dispatches once after the answer-idle budget expires and completes on the second attempt", async () => {
    const fetch = sequenceFetch([
      stalledResponse,
      () => jsonResponse(openAiSuccessBody({ issues: [] })),
    ]);

    const { result, reportDiagnostic } = await dispatch("openrouter", fetch);

    expect(result.receipt.outcome).toBe("completed");
    expect(fetch).toHaveBeenCalledTimes(2);
    const calls = vi.mocked(fetch).mock.calls;
    expect(String(calls[1]?.[1]?.body)).toBe(String(calls[0]?.[1]?.body));
    expect(result.receipt.attemptCount).toBe(2);
    expect(reportDiagnostic).not.toHaveBeenCalled();
    expect(warnLines("hosted_transport_timeout_retry")).toEqual([
      expect.objectContaining({
        productId: "openrouter",
        causeCode: "DIFFGAZER_ANSWER_IDLE_TIMEOUT",
      }),
    ]);
  });

  it("reports a second idle expiry as timed-out naming the idle budget, the wall and the attempt", async () => {
    const fetch = sequenceFetch([stalledResponse]);

    const { result, reportDiagnostic } = await dispatch("openrouter", fetch);

    expect(result.receipt.outcome).toBe("timed-out");
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(reportDiagnostic).toHaveBeenCalledTimes(1);
    expect(reportDiagnostic).toHaveBeenCalledWith(
      expect.objectContaining({
        code: "timed-out",
        retryable: true,
        safeMessage: expect.stringContaining(
          "sent only keep-alive whitespace for 0s (no answer bytes)",
        ),
      }),
    );
    const diagnostic = reportDiagnostic.mock.calls[0]?.[0];
    expect(diagnostic.safeMessage).toEqual(expect.stringContaining("attempt 2 of the 120s wall"));
    expect(diagnostic.safeMessage).toEqual(expect.not.stringContaining("wall-time limit"));
    expect(diagnostic.remediation).toEqual(expect.stringContaining("keeps billing"));
    expect(diagnostic.remediation).toEqual(expect.not.stringContaining("wall-time budget"));
    expect(warnLines("hosted_transport_timeout_retry")).toHaveLength(1);
    expect(JSON.stringify(reportDiagnostic.mock.calls)).not.toContain(PLAIN_CREDENTIAL);
    expect(JSON.stringify(vi.mocked(log).mock.calls)).not.toContain(PLAIN_CREDENTIAL);
  });

  it("completes when the answer lands inside the idle budget after keep-alive whitespace", async () => {
    const fetch = sequenceFetch([
      () => keepAliveResponse({ answerAfterMs: 150, answer: openAiSuccessBody({ issues: [] }) }),
    ]);

    const { result, reportDiagnostic } = await dispatch("openrouter", fetch);

    expect(result.receipt.outcome).toBe("completed");
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(result.receipt.attemptCount).toBe(1);
    expect(reportDiagnostic).not.toHaveBeenCalled();
    expect(warnLines("hosted_transport_timeout_retry")).toHaveLength(0);
  });

  it("reports a wall expiry on the re-dispatched attempt with the earlier idle history", async () => {
    vi.useFakeTimers();
    const fetch = vi
      .fn<FetchFn>()
      .mockImplementationOnce(async () => stalledResponse())
      // The re-dispatch keeps trickling answer bytes, so only the wall ends it.
      .mockImplementationOnce(async (_url, init) =>
        streamingResponse((controller) => {
          const trickle = setInterval(() => controller.enqueue(new TextEncoder().encode("{")), 100);
          init?.signal?.addEventListener("abort", () => {
            clearInterval(trickle);
            controller.error(init.signal?.reason);
          });
        }),
      );

    const pending = dispatch("openrouter", fetch, {
      limits: { ...limits, wallTimeMs: 100_000 },
    });
    await vi.advanceTimersByTimeAsync(100_000);
    const { result, reportDiagnostic } = await pending;

    expect(result.receipt.outcome).toBe("timed-out");
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(reportDiagnostic).toHaveBeenCalledTimes(1);
    const diagnostic = reportDiagnostic.mock.calls[0]?.[0];
    expect(diagnostic.safeMessage).toEqual(expect.stringContaining("wall-time limit"));
    expect(diagnostic.safeMessage).toEqual(
      expect.stringContaining(
        "accepted attempt 1 but sent only keep-alive whitespace for 0s (no answer bytes)",
      ),
    );
    expect(diagnostic.safeMessage).toEqual(expect.stringContaining("re-dispatched attempt 2"));
    expect(diagnostic.remediation).toEqual(expect.stringContaining("keeps billing"));
    expect(JSON.stringify(reportDiagnostic.mock.calls)).not.toContain(PLAIN_CREDENTIAL);
    expect(JSON.stringify(vi.mocked(log).mock.calls)).not.toContain(PLAIN_CREDENTIAL);
  });

  it("does not re-dispatch after an idle expiry when the remaining wall cannot fit a whole answer", async () => {
    const fetch = sequenceFetch([stalledResponse]);

    const { result, reportDiagnostic } = await dispatch("openrouter", fetch, {
      limits: { ...limits, wallTimeMs: 30_000 },
    });

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(result.receipt.outcome).toBe("timed-out");
    expect(reportDiagnostic).toHaveBeenCalledTimes(1);
    const diagnostic = reportDiagnostic.mock.calls[0]?.[0];
    expect(diagnostic.safeMessage).toEqual(expect.stringContaining("attempt 1 of the 30s wall"));
    expect(diagnostic.safeMessage).toEqual(expect.stringContaining("keep-alive whitespace"));
    expect(warnLines("hosted_transport_timeout_retry")).toHaveLength(0);
  });

  it("shares the one shot between a headers timeout and an idle expiry in either order", async () => {
    const fetch = vi
      .fn<FetchFn>()
      .mockRejectedValueOnce(headersTimeout())
      .mockImplementationOnce(async () => stalledResponse());

    const { result, reportDiagnostic } = await dispatch("openrouter", fetch);

    expect(fetch).toHaveBeenCalledTimes(2);
    expect(result.receipt.outcome).toBe("timed-out");
    expect(reportDiagnostic).toHaveBeenCalledTimes(1);
    const diagnostic = reportDiagnostic.mock.calls[0]?.[0];
    expect(diagnostic.safeMessage).toEqual(expect.stringContaining("keep-alive whitespace"));
    expect(diagnostic.safeMessage).toEqual(expect.stringContaining("attempt 2 of the 120s wall"));
  });

  it("shares the one shot between an idle expiry and a headers timeout in the reverse order", async () => {
    const fetch = vi
      .fn<FetchFn>()
      .mockImplementationOnce(async () => stalledResponse())
      .mockRejectedValueOnce(headersTimeout());

    const { result, reportDiagnostic } = await dispatch("openrouter", fetch);

    expect(fetch).toHaveBeenCalledTimes(2);
    expect(result.receipt.outcome).toBe("timed-out");
    expect(reportDiagnostic).toHaveBeenCalledTimes(1);
    expect(reportDiagnostic).toHaveBeenCalledWith(
      expect.objectContaining({
        safeMessage: expect.stringContaining("UND_ERR_HEADERS_TIMEOUT"),
      }),
    );
  });

  it("discards partial answer bytes before an idle expiry without debiting the response budget", async () => {
    // Had the partial `{"choices":[` been debited, the answer would no longer
    // fit the envelope and the second read would be oversize.
    const answer = openAiSuccessBody({ issues: [] });
    const answerBytes = new TextEncoder().encode(JSON.stringify(answer)).byteLength;
    const fetch = sequenceFetch([
      () => keepAliveResponse({ leadingBytes: '{"choices":[' }),
      () => jsonResponse(answer),
    ]);

    const { result } = await dispatch("openrouter", fetch, {
      limits: { ...limits, maxResponseBytes: answerBytes + 10 },
    });

    expect(result.receipt.outcome).toBe("completed");
    expect(result.receipt.attemptCount).toBe(2);
  });

  it("treats the transport's own body timeout as the client's timeout, not the answer-idle budget", async () => {
    const fetch = sequenceFetch([
      () => streamingResponse((controller) => controller.error(bodyTimeout())),
    ]);

    const { result, reportDiagnostic } = await dispatch("zai", fetch);

    expect(result.receipt.outcome).toBe("timed-out");
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(reportDiagnostic).toHaveBeenCalledTimes(1);
    const diagnostic = reportDiagnostic.mock.calls[0]?.[0];
    expect(diagnostic.safeMessage).toEqual(expect.stringContaining("UND_ERR_BODY_TIMEOUT"));
    expect(diagnostic.safeMessage).toEqual(expect.not.stringContaining("keep-alive whitespace"));
  });
});
