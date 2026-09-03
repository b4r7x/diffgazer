import { getErrorMessage } from "@diffgazer/core/errors";
import { PRODUCT_REGISTRY } from "@diffgazer/core/providers";
import type {
  ExecutionLimits,
  ExecutionResult,
  NormalizedUsage,
  ReviewResult,
  UsageAvailability,
} from "@diffgazer/core/schemas/review";
import { log } from "../../../log.js";
import { composeExecutionDeadline } from "../../deadline.js";
import {
  createCorrelationId,
  type FailureDiagnosticInput,
  serializeFailureDiagnostic,
} from "../../diagnostics.js";
import {
  ANSWER_IDLE_TIMEOUT_CAUSE,
  cancelResponseBody,
  createResponseLimitingFetch,
  readTextResponseWithLimit,
} from "../../http-json.js";
import {
  createCompletedExecutionResult,
  createFailedExecutionResult,
  promptAttemptEstimate,
} from "../execution-receipt.js";
import { accountResponse } from "./accounting.js";
import { describeExhaustedRateLimit, describeHttpFailure } from "./failure-classification.js";
import {
  buildOutputCorrection,
  correctionInputEstimate,
  type MalformedOutputContext,
  reportMalformedOutput,
  reportSalvagedOutput,
  reportTruncatedOutput,
  zodIssuePaths,
} from "./output-correction.js";
import { describePoolFailure } from "./pool-context.js";
import { validateHostedRequest } from "./preflight.js";
import { HTTP_DIAGNOSTIC_MAX_BYTES, resolveDispatchPacing } from "./profiles.js";
import {
  abortableDelay,
  RATE_LIMIT_RETRY_DELAYS_MS,
  rateLimitCodeBlocksRetry,
  rateLimitRetryDelayMs,
} from "./rate-limit.js";
import { recoverJsonObject } from "./recover-json.js";
import { salvageLensIssues } from "./salvage-issues.js";
import type { HostedExecuteRequest } from "./types.js";
import {
  buildRequestInit,
  buildRequestUrl,
  type OutputCorrection,
  parseProviderPayload,
} from "./wire.js";

function isAbortError(error: unknown): boolean {
  return (
    (error instanceof DOMException && error.name === "AbortError") ||
    (error instanceof Error && error.name === "AbortError")
  );
}

function isTimeoutError(error: unknown): boolean {
  return (
    (error instanceof DOMException && error.name === "TimeoutError") ||
    (error instanceof Error && error.name === "TimeoutError")
  );
}

/**
 * The runtime's own response timeouts. Node's fetch caps a silent response at
 * its default headers/body timeout (300s) regardless of the dispatch budget,
 * and reports it as a generic `TypeError: fetch failed` whose cause carries the
 * code — so without this check a dispatch that died of slowness would be filed
 * as an undiagnosed transport failure. The reader's answer-idle budget ends a
 * body that carries only keep-alive whitespace the same way, and a connection
 * that never completes ends the dispatch before any response arrives at all.
 */
const TRANSPORT_TIMEOUT_CAUSE_CODES = new Set([
  "UND_ERR_HEADERS_TIMEOUT",
  "UND_ERR_BODY_TIMEOUT",
  "UND_ERR_CONNECT_TIMEOUT",
  ANSWER_IDLE_TIMEOUT_CAUSE,
]);

// A declared idle budget bounds two phases; the cause code says which one
// expired.
const BUDGET_PHASE_BY_CAUSE: Record<string, "headers" | "body"> = {
  UND_ERR_HEADERS_TIMEOUT: "headers",
  [ANSWER_IDLE_TIMEOUT_CAUSE]: "body",
};

function errorCode(value: unknown): string | null {
  const code =
    typeof value === "object" && value !== null ? (value as { code?: unknown }).code : undefined;
  return typeof code === "string" ? code : null;
}

function transportTimeoutCause(error: unknown): string | null {
  const own = errorCode(error);
  if (own !== null && TRANSPORT_TIMEOUT_CAUSE_CODES.has(own)) return own;
  const cause = error instanceof Error ? errorCode(error.cause) : null;
  return cause !== null && TRANSPORT_TIMEOUT_CAUSE_CODES.has(cause) ? cause : null;
}

function isLengthFinishReason(finishReason: string | null): boolean {
  if (finishReason === null) return false;
  const normalized = finishReason.toLowerCase();
  return normalized === "length" || normalized === "max_tokens";
}

const SLOW_ANSWER_REMEDIATION =
  "Free pools queue and reasoning models answer slowly — retry, or pick a faster model.";

/**
 * A blind re-dispatch after a stalled response is worth its money only while
 * the wall still leaves room for a complete answer.
 *
 * A profile that declares an idle budget sits both the client's headers
 * timeout and the reader's answer-idle timer below the wall, and either expiry
 * is exactly what this retry serves. It is also the fallback for the fetch
 * paths that ignore the dispatcher — a non-undici runtime, or an injected
 * fetch — where the client's own response timeout is the bound that fires. It
 * also bounds the blind re-dispatch after a 2xx body that is not JSON.
 */
const TIMEOUT_RETRY_MIN_REMAINING_MS = 60_000;

export async function executeHostedReview(request: HostedExecuteRequest): Promise<ExecutionResult> {
  const { evidenceKey, context } = request;
  const preflight = validateHostedRequest(request);
  if (!preflight.ok) return preflight.result;
  const { hostedProductId, profile, endpoint, credential, structuredOutputMode, now, startedAt } =
    preflight.value;

  const admittedLimits = evidenceKey.limits;
  const promptInputEstimate = promptAttemptEstimate(
    {
      prompt: request.prompt,
      ...(request.systemPrompt === undefined ? {} : { systemPrompt: request.systemPrompt }),
    },
    admittedLimits,
  ).inputTokens;
  let remainingLimits: ExecutionLimits = { ...admittedLimits };
  let attemptCount = 0;
  let lastUsageAvailability: UsageAvailability = "unavailable";
  let reportedUsage: NormalizedUsage | null = null;
  let currentAttemptUsageAvailable = false;
  const fetcher = createResponseLimitingFetch(context.fetch ?? globalThis.fetch);
  const deadline = composeExecutionDeadline(admittedLimits.wallTimeMs, request.signal);
  const maxAttempts = Math.min(profile.malformedOutputRetry ? 2 : 1, admittedLimits.maxRetries + 1);
  // A product whose dispatch profile pins the per-dispatch wall overrides the
  // configured budget wall outright, so sending those users to the budget knob
  // would name a control that cannot move their deadline.
  const slowAnswerRemediation =
    profile.pacing?.perDispatchWallTimeMs === undefined
      ? "Free pools queue and reasoning models answer slowly — retry, pick a faster model, or raise the wall-time budget."
      : SLOW_ANSWER_REMEDIATION;

  const failed = (outcome: Parameters<typeof createFailedExecutionResult>[1]): ExecutionResult =>
    createFailedExecutionResult(request, outcome, {
      attemptCount,
      startedAt,
      finishedAt: now().toISOString(),
      ...(reportedUsage === null ? {} : { usage: reportedUsage }),
      usageAvailability: lastUsageAvailability,
    });

  const completed = (result: ReviewResult): ExecutionResult =>
    createCompletedExecutionResult(request, result, {
      attemptCount,
      startedAt,
      finishedAt: now().toISOString(),
      ...(reportedUsage === null ? {} : { usage: reportedUsage }),
      usageAvailability: lastUsageAvailability,
    });

  const productName = PRODUCT_REGISTRY[hostedProductId].presentation.name;
  const elapsedSeconds = () => Math.round((now().getTime() - Date.parse(startedAt)) / 1000);
  // The answer-idle budget: OpenRouter keeps a non-streaming connection alive
  // with whitespace chunks (probed 2026-09-02), so only answer bytes count.
  const { bodyIdleTimeoutMs } = resolveDispatchPacing(hostedProductId, evidenceKey.modelId);
  // Verified (openrouter.ai/docs/api-reference/streaming, 2026-09-02): "For
  // non-streaming requests … the model will continue processing and you will
  // be billed for the complete response." The local ledger settles an
  // abandoned attempt at zero, so the diagnostic is where the user learns it.
  const abandonedCallCostNote = `${productName} keeps processing — and on a paid route keeps billing — a non-streaming call this client abandons, so a stalled attempt and its re-dispatch may both be invoiced.`;

  const budgetExpiryHistory = (): string => {
    if (budgetExpiry === null || bodyIdleTimeoutMs === undefined) return "";
    const budgetSeconds = Math.round(bodyIdleTimeoutMs / 1000);
    if (budgetExpiry.phase === "headers") {
      return ` ${productName} sent no response headers for ${budgetSeconds}s on attempt ${budgetExpiry.attempt}, and the re-dispatched attempt ${attemptCount} did not finish either.`;
    }
    return ` ${productName} accepted attempt ${budgetExpiry.attempt} but sent only keep-alive whitespace for ${budgetSeconds}s (no answer bytes), and the re-dispatched attempt ${attemptCount} did not finish either.`;
  };

  /**
   * The wall deadline names its own numbers on expiry, so the lens error is
   * more than the bare timeout sentence. A plain cancel stays silent.
   */
  const timedOutOrCancelled = (): ExecutionResult => {
    if (!deadline.expired()) return failed("cancelled");
    request.reportDiagnostic?.(
      serializeFailureDiagnostic({
        code: "timed-out",
        retryable: true,
        message: `The dispatch hit its ${Math.round(admittedLimits.wallTimeMs / 1000)}s wall-time limit after ${elapsedSeconds()}s without a complete answer.${budgetExpiryHistory()}`,
        remediation:
          budgetExpiry === null
            ? slowAnswerRemediation
            : `${slowAnswerRemediation} ${abandonedCallCostNote}`,
        sensitive: { literalSecrets: [credential] },
      }),
    );
    return failed("timed-out");
  };

  /**
   * The HTTP client gave up before the wall deadline did: the runtime caps a
   * silent response well below a pinned per-dispatch wall, so name that as the
   * timeout instead of leaving an unexplained transport failure behind. Or the
   * profile's answer-idle budget cut a body that carried no answer, or the
   * profile's idle budget ended the headers phase of a gateway that commits
   * headers only when generation ends.
   */
  const transportTimedOut = (causeCode: string): ExecutionResult => {
    // A declared budget names itself and the phase it bounded; without one the
    // timeout is the client's own default and says so.
    const phase = bodyIdleTimeoutMs === undefined ? undefined : BUDGET_PHASE_BY_CAUSE[causeCode];
    const budgetExpiryMessage = (): string => {
      if (phase === undefined || bodyIdleTimeoutMs === undefined) {
        return `${productName} sent no response before the HTTP client's own response timeout (${causeCode}) after ${elapsedSeconds()}s.`;
      }
      const budgetSeconds = Math.round(bodyIdleTimeoutMs / 1000);
      const wallSeconds = Math.round(admittedLimits.wallTimeMs / 1000);
      if (phase === "headers") {
        return `${productName} sent no response headers for ${budgetSeconds}s (UND_ERR_HEADERS_TIMEOUT; a non-streaming gateway commits headers only when generation ends) — attempt ${attemptCount} of the ${wallSeconds}s wall`;
      }
      return `${productName} accepted the request but sent only keep-alive whitespace for ${budgetSeconds}s (no answer bytes) — attempt ${attemptCount} of the ${wallSeconds}s wall`;
    };
    request.reportDiagnostic?.(
      serializeFailureDiagnostic({
        code: "timed-out",
        retryable: true,
        message: budgetExpiryMessage(),
        remediation:
          phase === undefined
            ? SLOW_ANSWER_REMEDIATION
            : `${slowAnswerRemediation} ${abandonedCallCostNote}`,
        sensitive: { literalSecrets: [credential] },
      }),
    );
    return failed("timed-out");
  };

  /**
   * A terminal exit the user can act on: one bounded, scrubbed diagnostic on
   * the receipt and one warn line naming the same correlation id. Without it
   * the client synthesizes "Adapter transport failed." from the bare outcome.
   */
  const failWithDiagnostic = (
    event: string,
    outcome: Parameters<typeof createFailedExecutionResult>[1],
    input: Omit<FailureDiagnosticInput, "sensitive">,
    fields: Record<string, number> = {},
  ): ExecutionResult => {
    const diagnostic = serializeFailureDiagnostic({
      ...input,
      sensitive: { literalSecrets: [credential] },
    });
    log("warn", event, {
      productId: hostedProductId,
      code: diagnostic.code,
      correlationId: diagnostic.correlationId,
      safeMessage: diagnostic.safeMessage,
      details: diagnostic.truncatedDetails,
      ...fields,
    });
    request.reportDiagnostic?.(diagnostic);
    return failed(outcome);
  };

  // The pool a failure belongs to is the endpoint this dispatch is bound to,
  // never anything read back out of the response body.
  const poolFailure = {
    productId: hostedProductId,
    configurationId: request.configurationId,
    endpoint,
    modelId: evidenceKey.modelId,
  };

  let correction: OutputCorrection | null = null;
  let timeoutRetryUsed = false;
  let budgetExpiry: { phase: "headers" | "body"; attempt: number } | null = null;

  const canRetry = (extraInputTokens = 0): "retry" | "budget-exhausted" | "stop" => {
    if (!profile.malformedOutputRetry || attemptCount >= maxAttempts) return "stop";
    if (!currentAttemptUsageAvailable || reportedUsage === null) return "stop";
    if (remainingLimits.maxInputTokens < promptInputEstimate + extraInputTokens) {
      return "budget-exhausted";
    }
    if (remainingLimits.maxResponseBytes <= 0) return "budget-exhausted";
    return "retry";
  };

  try {
    if (promptInputEstimate > admittedLimits.maxInputTokens) {
      return failed("budget-exhausted");
    }

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const attemptInputEstimate =
        promptInputEstimate + (correction ? correctionInputEstimate(correction) : 0);
      if (remainingLimits.maxInputTokens < attemptInputEstimate) {
        return failed("budget-exhausted");
      }

      attemptCount += 1;
      if (deadline.signal.aborted) {
        return timedOutOrCancelled();
      }

      const url = buildRequestUrl(hostedProductId, endpoint, evidenceKey.modelId);
      const init = buildRequestInit({
        productId: hostedProductId,
        credential,
        evidenceKey,
        prompt: request.prompt,
        systemPrompt: request.systemPrompt,
        structuredOutputSchema: context.structuredOutputSchema,
        structuredOutputMode,
        ...(context.boundReasoning ? { boundReasoning: true } : {}),
        ...(correction ? { correction } : {}),
        signal: deadline.signal,
      });

      let response: Response;
      let rateLimitCapture: string | null = null;
      let rateLimitAttempt = 0;
      for (;;) {
        try {
          response = await fetcher(url, init);
        } catch (error) {
          if (isAbortError(error) || isTimeoutError(error)) {
            return timedOutOrCancelled();
          }
          const transportTimeout = transportTimeoutCause(error);
          if (transportTimeout === null) {
            const cause = error instanceof Error ? error.cause : undefined;
            const causeCode = errorCode(error) ?? errorCode(cause);
            return failWithDiagnostic(
              "hosted_fetch_failed",
              "transport-failed",
              {
                code: "fetch-failed",
                retryable: true,
                message: `The request to ${productName} failed (${causeCode ?? getErrorMessage(error)}) after ${elapsedSeconds()}s on attempt ${attemptCount}.`,
                remediation:
                  "Check the network and retry. If it keeps happening, the provider endpoint may be unreachable from this machine.",
                details: [
                  {
                    label: "cause",
                    text: `${getErrorMessage(error)}${
                      cause instanceof Error ? `: ${cause.name}: ${cause.message}` : ""
                    }`,
                  },
                ],
              },
              { attemptCount },
            );
          }
          if (
            timeoutRetryUsed ||
            attemptCount >= admittedLimits.maxRetries + 1 ||
            deadline.remainingMs() < TIMEOUT_RETRY_MIN_REMAINING_MS
          ) {
            return transportTimedOut(transportTimeout);
          }
          // The stall is the client's, not the model's verdict: re-dispatch the
          // same request once while the wall still fits a whole answer.
          timeoutRetryUsed = true;
          if (transportTimeout === "UND_ERR_HEADERS_TIMEOUT" && bodyIdleTimeoutMs !== undefined) {
            budgetExpiry = { phase: "headers", attempt: attemptCount };
          }
          attemptCount += 1;
          log("warn", "hosted_transport_timeout_retry", {
            productId: hostedProductId,
            causeCode: transportTimeout,
            remainingMs: deadline.remainingMs(),
          });
          continue;
        }
        if (response.status !== 429 || rateLimitAttempt >= RATE_LIMIT_RETRY_DELAYS_MS.length) {
          break;
        }
        const captured = await readTextResponseWithLimit(
          response,
          Math.min(remainingLimits.maxResponseBytes, HTTP_DIAGNOSTIC_MAX_BYTES),
          "Hosted error",
        );
        const capturedText = captured.ok ? captured.value : "";
        if (hostedProductId === "zai" && rateLimitCodeBlocksRetry(capturedText)) {
          rateLimitCapture = capturedText;
          break;
        }
        const delayMs = rateLimitRetryDelayMs(response, rateLimitAttempt);
        log("warn", "hosted_rate_limited", {
          productId: hostedProductId,
          delayMs,
          retriesLeft: RATE_LIMIT_RETRY_DELAYS_MS.length - 1 - rateLimitAttempt,
        });
        // The wait is not the model thinking, and a silent backoff reads as a
        // dead request, so the stream says which it is for as long as it lasts.
        request.reportProgress?.({
          message: `Rate-limited, retrying in ${Math.round(delayMs / 1000)}s`,
          holdsForMs: delayMs,
        });
        if (!(await abortableDelay(delayMs, deadline.signal))) {
          // The run is over, but the 429 evidence still matters: report it
          // before mapping the abort, or the rate limit leaves no trace.
          request.reportDiagnostic?.(
            serializeFailureDiagnostic({
              ...describeHttpFailure(
                hostedProductId,
                429,
                describePoolFailure({ ...poolFailure, status: 429 }) ?? undefined,
              ),
              capture: { channel: "response", text: capturedText },
              sensitive: { literalSecrets: [credential] },
            }),
          );
          return failed(deadline.expired() ? "timed-out" : "cancelled");
        }
        rateLimitAttempt += 1;
      }

      if (!response.ok) {
        let captured: { ok: true; value: string } | { ok: false } | null = null;
        if (rateLimitCapture !== null) {
          captured = { ok: true, value: rateLimitCapture };
        } else if (response.status >= 400 && response.status < 500) {
          captured = await readTextResponseWithLimit(
            response,
            Math.min(remainingLimits.maxResponseBytes, HTTP_DIAGNOSTIC_MAX_BYTES),
            "Hosted error",
          );
        }
        if (!captured) cancelResponseBody(response);
        const diagnostic = serializeFailureDiagnostic({
          ...(rateLimitCapture === null
            ? describeHttpFailure(
                hostedProductId,
                response.status,
                describePoolFailure({ ...poolFailure, status: response.status }) ?? undefined,
              )
            : describeExhaustedRateLimit(
                hostedProductId,
                describePoolFailure({ ...poolFailure, status: 429 }) ?? undefined,
              )),
          ...(captured
            ? { capture: { channel: "response", text: captured.ok ? captured.value : "" } }
            : {}),
          sensitive: { literalSecrets: [credential] },
        });
        log("warn", "hosted_request_failed", {
          productId: hostedProductId,
          status: response.status,
          correlationId: diagnostic.correlationId,
          safeMessage: diagnostic.safeMessage,
          details: diagnostic.truncatedDetails,
        });
        request.reportDiagnostic?.(diagnostic);
        return failed("transport-failed");
      }

      const bodyResult = await readTextResponseWithLimit(
        response,
        remainingLimits.maxResponseBytes,
        "Hosted provider",
        { answerIdleTimeoutMs: bodyIdleTimeoutMs },
      );
      if (!bodyResult.ok) {
        // A gateway commits 200 + headers as soon as the upstream accepts the
        // request, so a stalled generation expires the wall inside this read.
        if (deadline.signal.aborted) return timedOutOrCancelled();
        const idleTimeout = transportTimeoutCause(bodyResult.error.cause);
        if (idleTimeout !== null) {
          // The reader's answer-idle budget cut a body that carried no answer —
          // the twin of the headers timeout in the fetch catch above, sharing its one shot
          // and its floor. The re-dispatch takes the outer loop like the
          // non-JSON re-dispatch below; the attempt it spends is one the
          // stalled answer never earned.
          if (
            !timeoutRetryUsed &&
            attemptCount < maxAttempts &&
            deadline.remainingMs() >= TIMEOUT_RETRY_MIN_REMAINING_MS
          ) {
            timeoutRetryUsed = true;
            budgetExpiry = { phase: "body", attempt: attemptCount };
            log("warn", "hosted_transport_timeout_retry", {
              productId: hostedProductId,
              causeCode: idleTimeout,
              remainingMs: deadline.remainingMs(),
            });
            continue;
          }
          return transportTimedOut(idleTimeout);
        }
        if (bodyResult.error.code === "oversize-response") {
          if (attempt > 0) return failed("budget-exhausted");
          return failWithDiagnostic(
            "hosted_response_read_failed",
            "transport-failed",
            {
              code: "oversize-response",
              retryable: false,
              message: `${productName} sent more than ${remainingLimits.maxResponseBytes} bytes; the body was discarded.`,
              remediation: "Reduce the review scope, or raise the response-size budget.",
            },
            { attemptCount },
          );
        }
        return failWithDiagnostic(
          "hosted_response_read_failed",
          "transport-failed",
          {
            code: "response-read-failed",
            retryable: true,
            message: `${productName}'s response died while being read (${bodyResult.error.message}) after ${elapsedSeconds()}s on attempt ${attemptCount}.`,
            remediation:
              "Retry — the connection dropped before the answer was complete. If it keeps happening, pick a faster model or a different provider.",
          },
          { attemptCount },
        );
      }

      const responseBytes = new TextEncoder().encode(bodyResult.value).byteLength;
      let payload: unknown;
      try {
        payload = JSON.parse(bodyResult.value);
      } catch {
        // A 2xx that is not JSON is the gateway's page, not the model's answer:
        // one blind re-dispatch while the wall still fits a whole answer, then
        // a transport failure that names what came back.
        if (
          attemptCount < maxAttempts &&
          deadline.remainingMs() >= TIMEOUT_RETRY_MIN_REMAINING_MS
        ) {
          log("warn", "hosted_unparseable_response_retry", {
            productId: hostedProductId,
            status: response.status,
            responseBytes,
            remainingMs: deadline.remainingMs(),
          });
          // The page was buffered, so it spends the envelope like any other
          // answer. The read was capped at what remained, so this debit can
          // never itself exhaust the budget.
          remainingLimits = accountResponse(
            remainingLimits,
            reportedUsage,
            null,
            responseBytes,
          ).limits;
          continue;
        }
        const name =
          describePoolFailure({ ...poolFailure, status: response.status })?.poolLabel ??
          productName;
        return failWithDiagnostic(
          "hosted_unparseable_response",
          "transport-failed",
          {
            code: "unparseable-response",
            retryable: true,
            message: `${name} answered HTTP ${response.status} with a body that is not JSON (${response.headers.get("content-type") ?? "no content-type"}; ${responseBytes} bytes) after ${attemptCount} attempt(s).`,
            remediation:
              "Retry — the provider answered with something other than a model response. If it keeps happening, pick a different model or provider.",
            capture: { channel: "response", text: bodyResult.value },
          },
          { status: response.status, responseBytes, attemptCount },
        );
      }

      const parsed = parseProviderPayload(hostedProductId, payload);
      const usageAvailability: UsageAvailability = parsed.usage ? "reported" : "unavailable";
      // A retry repeats the prompt, so it needs a trustworthy input/output
      // report from the attempt that just failed. Partial usage remains useful
      // for the terminal receipt, but it cannot establish a safe retry
      // envelope. In particular, never infer an absent component from total.
      currentAttemptUsageAvailable =
        usageAvailability === "reported" &&
        parsed.usage?.inputTokens !== undefined &&
        parsed.usage.outputTokens !== undefined;
      const previousReportedUsage: NormalizedUsage | null = reportedUsage;
      const accounting = accountResponse(
        remainingLimits,
        previousReportedUsage,
        parsed.usage,
        responseBytes,
      );
      remainingLimits = accounting.limits;
      reportedUsage = accounting.usage ?? previousReportedUsage;
      // The receipt carries the trustworthy aggregate across consumed
      // attempts. Keep it reported when a later optional response omits or
      // invalidates usage; currentAttemptUsageAvailable above still records
      // that this particular attempt was not retry-safe.
      lastUsageAvailability = reportedUsage === null ? usageAvailability : "reported";
      if (accounting.status === "budget-exhausted") return failed("budget-exhausted");

      const lengthFinish =
        isLengthFinishReason(parsed.finishReason) ||
        isLengthFinishReason(parsed.nativeFinishReason);
      const reportedFinishReason = parsed.finishReason ?? parsed.nativeFinishReason ?? "unknown";

      // finish "error" or a choice-level error object means the upstream died
      // mid-generation: transport-class, never evidence against the model's
      // answer. Checked before the reasoning trap — a reasoning burn that ends
      // in an upstream death is the death, not the burn. The retry is blind
      // (no correction turns): upstream routing is the nondeterminism.
      const errorFinish =
        parsed.finishReason?.toLowerCase() === "error" ||
        parsed.nativeFinishReason?.toLowerCase() === "error";
      if (errorFinish || parsed.choiceError !== null) {
        const diagnostic = serializeFailureDiagnostic({
          code: "provider-generation-error",
          retryable: true,
          message: `The upstream provider failed mid-generation (finish reason "${reportedFinishReason}"${
            parsed.choiceError?.message ? `: ${parsed.choiceError.message}` : ""
          }).`,
          remediation:
            "The upstream provider failed mid-generation; retrying may route to a different provider.",
          ...(parsed.content ? { capture: { channel: "response", text: parsed.content } } : {}),
          sensitive: { literalSecrets: [credential] },
        });
        log("warn", "hosted_provider_generation_error", {
          productId: hostedProductId,
          code: diagnostic.code,
          correlationId: diagnostic.correlationId,
          safeMessage: diagnostic.safeMessage,
          details: diagnostic.truncatedDetails,
        });
        request.reportDiagnostic?.(diagnostic);
        const retry = canRetry();
        if (retry === "retry") continue;
        return failed(retry === "budget-exhausted" ? "budget-exhausted" : "transport-failed");
      }

      const reasoningTokens = parsed.usage?.reasoningTokens ?? 0;
      // Empty content beside spent reasoning tokens IS the reasoning trap,
      // whatever the finish reason claims: a reasoning-default route has been
      // observed stopping with finish "stop" after burning its whole output on
      // thought, so gating on a length-like finish let the real case through.
      if ((!parsed.content || parsed.content.trim() === "") && reasoningTokens > 0) {
        // No retry: an identical re-ask re-spends the same reasoning budget on
        // the same empty answer.
        request.reportDiagnostic?.(
          serializeFailureDiagnostic({
            code: "reasoning-budget-consumed",
            retryable: false,
            message: `The model spent its output on reasoning (${reasoningTokens} reasoning tokens, finish reason "${reportedFinishReason}") and returned no review content.`,
            remediation:
              "Pick a non-reasoning model, or a provider/plan with a larger completion budget.",
            sensitive: { literalSecrets: [credential] },
          }),
        );
        return failed("schema-failed");
      }

      if (!parsed.content) {
        const retry = canRetry();
        if (retry === "retry") continue;
        if (retry === "budget-exhausted") return failed("budget-exhausted");
        const name =
          describePoolFailure({ ...poolFailure, status: response.status })?.poolLabel ??
          productName;
        return failWithDiagnostic(
          "hosted_empty_content",
          "transport-failed",
          {
            code: "empty-content",
            retryable: true,
            message: `${name} returned an empty answer (finish reason "${reportedFinishReason}", no reasoning tokens reported) after ${attemptCount} attempt(s).`,
            remediation:
              "Retry, or pick a different model — the route answered without content on every attempt.",
          },
          { attemptCount },
        );
      }

      // One id for this answer's outcome: whether it ends as a malformed-output
      // diagnostic or as a salvage warning, the log line names the same dispatch.
      const outputContext: MalformedOutputContext = {
        productId: hostedProductId,
        correlationId: createCorrelationId(),
        finishReason: reportedFinishReason,
        content: parsed.content ?? "",
        credential,
        ...(request.reportDiagnostic ? { reportDiagnostic: request.reportDiagnostic } : {}),
      };

      /**
       * The last tier, reached only once the corrective retry is spent: the
       * findings that validate on their own are kept instead of dying with the
       * malformed answer around them. An answer with nothing salvageable takes
       * the terminal path unchanged, so the conformance memo it arms and the
       * review-level MODEL_INCOMPATIBLE fold both stay as they were. A partial
       * salvage is still qualified — the user is told the answer was incomplete
       * and how many candidates it cost, rather than being handed the kept
       * findings as a whole lens.
       */
      const salvageOrFail = (payload: unknown, reportFailure: () => void): ExecutionResult => {
        const salvaged = salvageLensIssues(payload, parsed.content ?? "");
        if (salvaged.issues.length === 0) {
          reportFailure();
          return failed("schema-failed");
        }
        reportSalvagedOutput(outputContext, {
          keptCount: salvaged.issues.length,
          droppedCount: salvaged.droppedCount,
        });
        return completed({ issues: salvaged.issues });
      };

      let reviewPayload: unknown;
      try {
        reviewPayload = JSON.parse(parsed.content);
      } catch {
        reviewPayload = recoverJsonObject(parsed.content);
      }

      if (reviewPayload === null || reviewPayload === undefined) {
        if (lengthFinish) {
          // No retry: the same prompt overruns the same completion cap. The
          // issues the answer completed before the cut are still findings.
          return salvageOrFail(reviewPayload, () => reportTruncatedOutput(outputContext));
        }
        // The corrective retry replays the failed answer and names what was
        // wrong with it. The correction turns count into the retry's input
        // estimate so the budget still bounds it.
        const candidate = buildOutputCorrection(parsed.content, "it was not parseable JSON.");
        const retry = canRetry(correctionInputEstimate(candidate));
        if (retry === "retry") {
          correction = candidate;
          continue;
        }
        if (retry === "budget-exhausted") return failed("budget-exhausted");
        return salvageOrFail(reviewPayload, () =>
          reportMalformedOutput(outputContext, {
            stage: "JSON parsing",
            corrected: correction !== null,
          }),
        );
      }

      const validated = context.reviewSchema.safeParse(reviewPayload);
      if (!validated.success) {
        const invalidPaths = zodIssuePaths(validated.error);
        const candidate = buildOutputCorrection(
          parsed.content,
          `these fields were missing or invalid: ${invalidPaths.join(", ")}.`,
        );
        const retry = canRetry(correctionInputEstimate(candidate));
        if (retry === "retry") {
          correction = candidate;
          continue;
        }
        if (retry === "budget-exhausted") return failed("budget-exhausted");
        return salvageOrFail(reviewPayload, () =>
          reportMalformedOutput(outputContext, {
            stage: "review schema validation",
            corrected: correction !== null,
            invalidPaths,
          }),
        );
      }

      return completed(validated.data as ReviewResult);
    }

    return failed("schema-failed");
  } finally {
    deadline.dispose();
  }
}
