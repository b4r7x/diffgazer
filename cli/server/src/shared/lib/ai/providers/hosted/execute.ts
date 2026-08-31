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
import { createCorrelationId, serializeFailureDiagnostic } from "../../diagnostics.js";
import {
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
import { HTTP_DIAGNOSTIC_MAX_BYTES } from "./profiles.js";
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
 * as an undiagnosed transport failure.
 */
const TRANSPORT_TIMEOUT_CAUSE_CODES = new Set(["UND_ERR_HEADERS_TIMEOUT", "UND_ERR_BODY_TIMEOUT"]);

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
 * The sized dispatcher holds the client's response timeout above the dispatch
 * wall, so wherever `RequestInit.dispatcher` is honored the wall aborts first
 * and this retry never runs. It is the fallback for the fetch paths that ignore
 * the dispatcher — a non-undici runtime, or an injected fetch — where the
 * client's own response timeout is the bound that fires.
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

  /**
   * The wall deadline names its own numbers on expiry, so the lens error is
   * more than the bare timeout sentence. A plain cancel stays silent.
   */
  const timedOutOrCancelled = (): ExecutionResult => {
    if (!deadline.expired()) return failed("cancelled");
    const elapsedSeconds = Math.round((now().getTime() - Date.parse(startedAt)) / 1000);
    request.reportDiagnostic?.(
      serializeFailureDiagnostic({
        code: "timed-out",
        retryable: true,
        message: `The dispatch hit its ${Math.round(admittedLimits.wallTimeMs / 1000)}s wall-time limit after ${elapsedSeconds}s without a complete answer.`,
        remediation: slowAnswerRemediation,
        sensitive: { literalSecrets: [credential] },
      }),
    );
    return failed("timed-out");
  };

  /**
   * The HTTP client gave up before the wall deadline did: the runtime caps a
   * silent response well below a pinned per-dispatch wall, so name that as the
   * timeout instead of leaving an unexplained transport failure behind.
   */
  const transportTimedOut = (causeCode: string): ExecutionResult => {
    const elapsedSeconds = Math.round((now().getTime() - Date.parse(startedAt)) / 1000);
    request.reportDiagnostic?.(
      serializeFailureDiagnostic({
        code: "timed-out",
        retryable: true,
        message: `${PRODUCT_REGISTRY[hostedProductId].presentation.name} sent no response before the HTTP client's own response timeout (${causeCode}) after ${elapsedSeconds}s.`,
        remediation: SLOW_ANSWER_REMEDIATION,
        sensitive: { literalSecrets: [credential] },
      }),
    );
    return failed("timed-out");
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
            return failed("transport-failed");
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
      );
      if (!bodyResult.ok) {
        return failed(
          attempt > 0 && bodyResult.error.code === "oversize-response"
            ? "budget-exhausted"
            : "transport-failed",
        );
      }

      const responseBytes = new TextEncoder().encode(bodyResult.value).byteLength;
      let payload: unknown;
      try {
        payload = JSON.parse(bodyResult.value);
      } catch {
        return failed("schema-failed");
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
        return failed(retry === "budget-exhausted" ? "budget-exhausted" : "schema-failed");
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
