import { PRODUCT_REGISTRY } from "@diffgazer/core/providers";
import { HOSTED_API_PRODUCT_IDS, type HostedApiProductId } from "@diffgazer/core/schemas/config";
import type {
  ExecutionLimits,
  ExecutionResult,
  NormalizedUsage,
  ReviewResult,
  UsageAvailability,
} from "@diffgazer/core/schemas/review";
import { log } from "../../../log.js";
import { composeExecutionDeadline } from "../../deadline.js";
import { serializeFailureDiagnostic } from "../../diagnostics.js";
import {
  cancelResponseBody,
  createResponseLimitingFetch,
  readTextResponseWithLimit,
} from "../../http-json.js";
import { resolveHostedApiEndpoint } from "../endpoints.js";
import {
  createCompletedExecutionResult,
  createFailedExecutionResult,
  promptAttemptEstimate,
} from "../execution-receipt.js";
import { HOSTED_PROFILES, RATE_LIMIT_DIAGNOSTIC_MAX_BYTES } from "./profiles.js";
import type { HostedExecuteRequest } from "./types.js";
import {
  accumulateUsage,
  buildRequestInit,
  buildRequestUrl,
  parseProviderPayload,
  resolveUsageAvailability,
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

function validateNoticeVersion(productId: HostedApiProductId, noticeVersion: number): boolean {
  return PRODUCT_REGISTRY[productId].notice.noticeVersion === noticeVersion;
}

type ResponseAccounting = Readonly<{
  limits: ExecutionLimits;
  usage: NormalizedUsage | null;
  status: "accounted" | "unavailable" | "budget-exhausted";
}>;

function accountResponse(
  limits: ExecutionLimits,
  admittedLimits: ExecutionLimits,
  reportedUsage: NormalizedUsage | null,
  attemptUsage: NormalizedUsage | null,
  responseBytes: number,
): ResponseAccounting {
  const nextLimits = {
    ...limits,
    maxResponseBytes: limits.maxResponseBytes - responseBytes,
  };
  if (nextLimits.maxResponseBytes < 0) {
    return { limits: nextLimits, usage: reportedUsage, status: "budget-exhausted" };
  }
  if (!attemptUsage) {
    return { limits: nextLimits, usage: reportedUsage, status: "unavailable" };
  }

  const usage = accumulateUsage(reportedUsage, attemptUsage);
  if (!usage) {
    return { limits: nextLimits, usage: reportedUsage, status: "unavailable" };
  }

  const nextInputTokens = limits.maxInputTokens - (attemptUsage.inputTokens ?? 0);
  const nextOutputTokens = limits.maxOutputTokens - (attemptUsage.outputTokens ?? 0);
  const totalTokenLimit = admittedLimits.maxInputTokens + admittedLimits.maxOutputTokens;
  const overCap =
    nextInputTokens < 0 ||
    nextOutputTokens < 0 ||
    (usage.totalTokens !== undefined && usage.totalTokens > totalTokenLimit);
  return {
    limits: {
      ...nextLimits,
      maxInputTokens: nextInputTokens,
      maxOutputTokens: nextOutputTokens,
    },
    usage,
    status: overCap ? "budget-exhausted" : "accounted",
  };
}

export async function executeHostedReview(request: HostedExecuteRequest): Promise<ExecutionResult> {
  const { evidenceKey, context } = request;
  const productId = evidenceKey.productId;
  if (!(HOSTED_API_PRODUCT_IDS as readonly string[]).includes(productId)) {
    return createFailedExecutionResult(request, "transport-failed", {
      attemptCount: 0,
      startedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString(),
    });
  }

  const hostedProductId = productId as HostedApiProductId;
  const profile = HOSTED_PROFILES[hostedProductId];
  const now = context.now ?? (() => new Date());
  const startedAt = now().toISOString();

  if (evidenceKey.transportFamily !== "hosted-api") {
    return createFailedExecutionResult(request, "transport-failed", {
      attemptCount: 0,
      startedAt,
      finishedAt: now().toISOString(),
    });
  }

  if (!validateNoticeVersion(hostedProductId, evidenceKey.noticeVersion)) {
    return createFailedExecutionResult(request, "transport-failed", {
      attemptCount: 0,
      startedAt,
      finishedAt: now().toISOString(),
    });
  }

  const endpointResult = resolveHostedApiEndpoint({
    productId: hostedProductId,
    endpoint: evidenceKey.normalizedEndpoint ?? "",
    region: evidenceKey.region ?? undefined,
    workspace:
      evidenceKey.workspaceAccountReference === null
        ? undefined
        : (context.workspaceAccountId ?? undefined),
  });
  if (!endpointResult.ok) {
    return createFailedExecutionResult(request, "transport-failed", {
      attemptCount: 0,
      startedAt,
      finishedAt: now().toISOString(),
    });
  }

  if (!context.credential) {
    return createFailedExecutionResult(request, "transport-failed", {
      attemptCount: 0,
      startedAt,
      finishedAt: now().toISOString(),
    });
  }

  if (
    profile.structuredOutput === "strict-json-schema" &&
    context.structuredOutputSchema === undefined
  ) {
    return createFailedExecutionResult(request, "transport-failed", {
      attemptCount: 0,
      startedAt,
      finishedAt: now().toISOString(),
    });
  }

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

  const failed = (outcome: Parameters<typeof createFailedExecutionResult>[1]): ExecutionResult =>
    createFailedExecutionResult(request, outcome, {
      attemptCount,
      startedAt,
      finishedAt: now().toISOString(),
      ...(reportedUsage === null ? {} : { usage: reportedUsage }),
      usageAvailability: lastUsageAvailability,
    });

  const canRetry = (): "retry" | "budget-exhausted" | "stop" => {
    if (!profile.malformedOutputRetry || attemptCount >= maxAttempts) return "stop";
    if (!currentAttemptUsageAvailable || reportedUsage === null) return "stop";
    if (remainingLimits.maxInputTokens < promptInputEstimate) return "budget-exhausted";
    if (remainingLimits.maxOutputTokens <= 0 || remainingLimits.maxResponseBytes <= 0) {
      return "budget-exhausted";
    }
    return "retry";
  };

  try {
    if (promptInputEstimate > admittedLimits.maxInputTokens) {
      return failed("budget-exhausted");
    }

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      if (remainingLimits.maxInputTokens < promptInputEstimate) {
        return failed("budget-exhausted");
      }

      attemptCount += 1;
      if (deadline.signal.aborted) {
        return failed(deadline.expired() ? "timed-out" : "cancelled");
      }

      const url = buildRequestUrl(
        hostedProductId,
        endpointResult.value.endpoint,
        evidenceKey.modelId,
      );
      const init = buildRequestInit({
        productId: hostedProductId,
        credential: context.credential,
        evidenceKey,
        prompt: request.prompt,
        systemPrompt: request.systemPrompt,
        limits: remainingLimits,
        structuredOutputSchema: context.structuredOutputSchema,
        workspaceAccountId: context.workspaceAccountId,
        signal: deadline.signal,
      });

      let response: Response;
      try {
        response = await fetcher(url, init);
      } catch (error) {
        if (isAbortError(error) || isTimeoutError(error)) {
          return failed(deadline.expired() ? "timed-out" : "cancelled");
        }
        return failed("transport-failed");
      }

      if (response.status === 429) {
        const captured = await readTextResponseWithLimit(
          response,
          Math.min(remainingLimits.maxResponseBytes, RATE_LIMIT_DIAGNOSTIC_MAX_BYTES),
          "Hosted rate-limit",
        );
        const diagnostic = serializeFailureDiagnostic({
          code: "rate-limited",
          message: "Hosted provider rate limited the request.",
          retryable: true,
          capture: { channel: "response", text: captured.ok ? captured.value : "" },
          sensitive: { literalSecrets: [context.credential] },
        });
        log("warn", "hosted_rate_limited", {
          productId: hostedProductId,
          correlationId: diagnostic.correlationId,
          safeMessage: diagnostic.safeMessage,
          details: diagnostic.truncatedDetails,
        });
        return failed("transport-failed");
      }

      if (!response.ok) {
        cancelResponseBody(response);
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
      const usageAvailability = resolveUsageAvailability(
        hostedProductId,
        parsed.usage,
        parsed.usageFieldPresent,
      );
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
        admittedLimits,
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

      if (usageAvailability === "required-missing") {
        return failed("transport-failed");
      }
      if (profile.usageContract === "required-terminal" && usageAvailability !== "reported") {
        return failed("transport-failed");
      }

      if (!parsed.content) {
        const retry = canRetry();
        if (retry === "retry") continue;
        return failed(retry === "budget-exhausted" ? "budget-exhausted" : "schema-failed");
      }

      let reviewPayload: unknown;
      try {
        reviewPayload = JSON.parse(parsed.content);
      } catch {
        const retry = canRetry();
        if (retry === "retry") continue;
        return failed(retry === "budget-exhausted" ? "budget-exhausted" : "schema-failed");
      }

      const validated = context.reviewSchema.safeParse(reviewPayload);
      if (!validated.success) {
        const retry = canRetry();
        if (retry === "retry") continue;
        return failed(retry === "budget-exhausted" ? "budget-exhausted" : "schema-failed");
      }

      return createCompletedExecutionResult(request, validated.data as ReviewResult, {
        attemptCount,
        startedAt,
        finishedAt: now().toISOString(),
        ...(reportedUsage === null ? {} : { usage: reportedUsage }),
        usageAvailability: lastUsageAvailability,
      });
    }

    return failed("schema-failed");
  } finally {
    deadline.dispose();
  }
}
