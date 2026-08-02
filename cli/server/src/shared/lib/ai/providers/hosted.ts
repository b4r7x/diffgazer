import { PRODUCT_REGISTRY } from "@diffgazer/core/providers";
import type { Result } from "@diffgazer/core/result";
import { HOSTED_API_PRODUCT_IDS, type HostedApiProductId } from "@diffgazer/core/schemas/config";
import {
  type EvidenceKey,
  type ExecutionLimits,
  type ExecutionResult,
  LensReviewResultSchema,
  type NormalizedUsage,
  type ReviewResult,
  type UsageAvailability,
} from "@diffgazer/core/schemas/review";
import type { z } from "zod";
import { log } from "../../log.js";
import type { AttemptEstimate, BudgetLedger, BudgetReservation } from "../budget/ledger.js";
import { serializeFailureDiagnostic } from "../diagnostics.js";
import { createResponseLimitingFetch, readTextResponseWithLimit } from "../http-json.js";
import type { Adapter, AdapterExecuteRequest } from "../types.js";
import { buildReviewSchemaJson } from "./cli-compatibility-probe.js";
import {
  boundedFetchInit,
  type EndpointFailure,
  type ResolvedHostedEndpoint,
  type ResolveHostedEndpointInput,
  resolveHostedApiEndpoint,
} from "./endpoints.js";
import {
  createCompletedExecutionResult,
  createFailedExecutionResult,
  type FailedTerminalOutcome,
} from "./execution-receipt.js";

export { boundedFetchInit } from "./endpoints.js";

/** The lens review schema every hosted generation validates its output against. */
export const DEFAULT_HOSTED_REVIEW_SCHEMA = LensReviewResultSchema;

/** The admitted review-result JSON schema every hosted generation must request. */
const REVIEW_RESULT_JSON_SCHEMA = buildReviewSchemaJson() as Record<string, unknown>;

export type HostedExecutionContext = Readonly<{
  credential: string;
  reviewSchema: z.ZodType;
  structuredOutputSchema?: Record<string, unknown>;
  workspaceAccountId?: string | null;
  fetch?: typeof fetch;
  budgetLedger?: BudgetLedger;
  now?: () => Date;
}>;

export type HostedAdapterDependencies = Readonly<{
  resolveContext: (request: AdapterExecuteRequest) => Promise<HostedExecutionContext | null>;
}>;

export type HostedExecuteRequest = AdapterExecuteRequest &
  Readonly<{
    context: HostedExecutionContext;
  }>;

type HostedWireFamily = "google" | "openai-compatible" | "openrouter";

type HostedProductProfile = Readonly<{
  wireFamily: HostedWireFamily;
  structuredOutput: "strict-json-schema" | "json-object-local-validation";
  usageContract: "optional" | "required-terminal";
  malformedOutputRetry: boolean;
}>;

const HOSTED_PROFILES = {
  gemini: {
    wireFamily: "google",
    structuredOutput: "strict-json-schema",
    usageContract: "optional",
    malformedOutputRetry: false,
  },
  zai: {
    wireFamily: "openai-compatible",
    structuredOutput: "json-object-local-validation",
    usageContract: "optional",
    malformedOutputRetry: true,
  },
  openrouter: {
    wireFamily: "openrouter",
    structuredOutput: "strict-json-schema",
    usageContract: "optional",
    malformedOutputRetry: false,
  },
  groq: {
    wireFamily: "openai-compatible",
    structuredOutput: "strict-json-schema",
    usageContract: "optional",
    malformedOutputRetry: false,
  },
  cerebras: {
    wireFamily: "openai-compatible",
    structuredOutput: "strict-json-schema",
    usageContract: "optional",
    malformedOutputRetry: false,
  },
  deepseek: {
    wireFamily: "openai-compatible",
    structuredOutput: "json-object-local-validation",
    usageContract: "required-terminal",
    malformedOutputRetry: true,
  },
  qwen: {
    wireFamily: "openai-compatible",
    structuredOutput: "json-object-local-validation",
    usageContract: "required-terminal",
    malformedOutputRetry: true,
  },
  moonshot: {
    wireFamily: "openai-compatible",
    structuredOutput: "strict-json-schema",
    usageContract: "required-terminal",
    malformedOutputRetry: false,
  },
  mistral: {
    wireFamily: "openai-compatible",
    structuredOutput: "strict-json-schema",
    usageContract: "optional",
    malformedOutputRetry: false,
  },
} as const satisfies Record<HostedApiProductId, HostedProductProfile>;

export function validateHostedEndpoint(
  input: ResolveHostedEndpointInput,
): Result<ResolvedHostedEndpoint, EndpointFailure> {
  return resolveHostedApiEndpoint(input);
}

function profileFor(productId: HostedApiProductId): HostedProductProfile {
  return HOSTED_PROFILES[productId];
}

/** Rate-limit bodies are diagnostics, never payloads: cap the read at 64 KiB. */
const RATE_LIMIT_DIAGNOSTIC_MAX_BYTES = 64 * 1024;

function estimatePromptTokens(prompt: string): number {
  return Math.ceil(prompt.length / 4);
}

function failedResult(
  request: AdapterExecuteRequest,
  outcome: FailedTerminalOutcome,
  input: Readonly<{
    attemptCount: number;
    startedAt: string;
    finishedAt: string;
    usage?: NormalizedUsage;
    usageAvailability?: UsageAvailability;
  }>,
): ExecutionResult {
  return createFailedExecutionResult(request, outcome, input);
}

function attemptEstimate(prompt: string, limits: ExecutionLimits): AttemptEstimate {
  return {
    inputTokens: Math.min(estimatePromptTokens(prompt), limits.maxInputTokens),
    outputTokens: limits.maxOutputTokens,
    responseBytes: limits.maxResponseBytes,
    wallTimeMs: limits.wallTimeMs,
    costUsd: limits.maxCostUsd,
  };
}

function normalizeOpenAiUsage(raw: unknown): NormalizedUsage | null {
  if (!raw || typeof raw !== "object") return null;
  const usage = raw as Record<string, unknown>;
  const inputTokens = typeof usage.prompt_tokens === "number" ? usage.prompt_tokens : undefined;
  const outputTokens =
    typeof usage.completion_tokens === "number" ? usage.completion_tokens : undefined;
  const totalTokens = typeof usage.total_tokens === "number" ? usage.total_tokens : undefined;
  const cachedTokens =
    typeof usage.prompt_tokens_details === "object" &&
    usage.prompt_tokens_details !== null &&
    typeof (usage.prompt_tokens_details as Record<string, unknown>).cached_tokens === "number"
      ? ((usage.prompt_tokens_details as Record<string, unknown>).cached_tokens as number)
      : undefined;
  const reasoningTokens =
    typeof usage.completion_tokens_details === "object" &&
    usage.completion_tokens_details !== null &&
    typeof (usage.completion_tokens_details as Record<string, unknown>).reasoning_tokens ===
      "number"
      ? ((usage.completion_tokens_details as Record<string, unknown>).reasoning_tokens as number)
      : undefined;

  const normalized: NormalizedUsage = {
    ...(inputTokens !== undefined ? { inputTokens } : {}),
    ...(outputTokens !== undefined ? { outputTokens } : {}),
    ...(totalTokens !== undefined ? { totalTokens } : {}),
    ...(cachedTokens !== undefined ? { cachedTokens } : {}),
    ...(reasoningTokens !== undefined ? { reasoningTokens } : {}),
  };
  return Object.keys(normalized).length > 0 ? normalized : null;
}

function normalizeGoogleUsage(raw: unknown): NormalizedUsage | null {
  if (!raw || typeof raw !== "object") return null;
  const usage = raw as Record<string, unknown>;
  const inputTokens =
    typeof usage.promptTokenCount === "number" ? usage.promptTokenCount : undefined;
  const outputTokens =
    typeof usage.candidatesTokenCount === "number" ? usage.candidatesTokenCount : undefined;
  const totalTokens = typeof usage.totalTokenCount === "number" ? usage.totalTokenCount : undefined;
  const cachedTokens =
    typeof usage.cachedContentTokenCount === "number" ? usage.cachedContentTokenCount : undefined;

  const normalized: NormalizedUsage = {
    ...(inputTokens !== undefined ? { inputTokens } : {}),
    ...(outputTokens !== undefined ? { outputTokens } : {}),
    ...(totalTokens !== undefined ? { totalTokens } : {}),
    ...(cachedTokens !== undefined ? { cachedTokens } : {}),
  };
  return Object.keys(normalized).length > 0 ? normalized : null;
}

function extractOpenAiContent(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const choices = (payload as Record<string, unknown>).choices;
  if (!Array.isArray(choices) || choices.length === 0) return null;
  const first = choices[0];
  if (!first || typeof first !== "object") return null;
  const message = (first as Record<string, unknown>).message;
  if (!message || typeof message !== "object") return null;
  const content = (message as Record<string, unknown>).content;
  return typeof content === "string" ? content : null;
}

function extractGoogleContent(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const candidates = (payload as Record<string, unknown>).candidates;
  if (!Array.isArray(candidates) || candidates.length === 0) return null;
  const first = candidates[0];
  if (!first || typeof first !== "object") return null;
  const content = (first as Record<string, unknown>).content;
  if (!content || typeof content !== "object") return null;
  const parts = (content as Record<string, unknown>).parts;
  if (!Array.isArray(parts) || parts.length === 0) return null;
  const text = parts
    .map((part) =>
      part && typeof part === "object" && typeof (part as Record<string, unknown>).text === "string"
        ? ((part as Record<string, unknown>).text as string)
        : "",
    )
    .join("");
  return text.length > 0 ? text : null;
}

function buildOpenAiResponseFormat(
  profile: HostedProductProfile,
  structuredOutputSchema?: Record<string, unknown>,
): Record<string, unknown> | undefined {
  if (profile.structuredOutput === "json-object-local-validation") {
    return { type: "json_object" };
  }
  if (!structuredOutputSchema) return undefined;
  return {
    type: "json_schema",
    json_schema: {
      name: "review_result",
      strict: true,
      schema: structuredOutputSchema,
    },
  };
}

function buildRequestUrl(productId: HostedApiProductId, endpoint: string, modelId: string): string {
  const profile = profileFor(productId);
  switch (profile.wireFamily) {
    case "google":
      return `${endpoint}/models/${encodeURIComponent(modelId)}:generateContent`;
    case "openrouter":
    case "openai-compatible":
      return `${endpoint}/chat/completions`;
  }
}

function buildRequestInit(
  input: Readonly<{
    productId: HostedApiProductId;
    credential: string;
    evidenceKey: EvidenceKey;
    prompt: string;
    limits: ExecutionLimits;
    structuredOutputSchema?: Record<string, unknown>;
    workspaceAccountId?: string | null;
    signal?: AbortSignal;
  }>,
): RequestInit {
  const profile = profileFor(input.productId);
  const maxOutputTokens = input.limits.maxOutputTokens;
  const headers: Record<string, string> = {
    "content-type": "application/json",
    accept: "application/json",
  };

  let body: Record<string, unknown>;

  switch (profile.wireFamily) {
    case "google": {
      headers["x-goog-api-key"] = input.credential;
      body = {
        contents: [{ role: "user", parts: [{ text: input.prompt }] }],
        generationConfig: {
          temperature: 0,
          maxOutputTokens,
          responseMimeType: "application/json",
          ...(input.structuredOutputSchema ? { responseSchema: input.structuredOutputSchema } : {}),
        },
      };
      break;
    }
    case "openrouter": {
      headers.authorization = `Bearer ${input.credential}`;
      headers["http-referer"] = "https://diffgazer.local";
      headers["x-title"] = "Diffgazer";
      body = {
        model: input.evidenceKey.modelId,
        messages: [{ role: "user", content: input.prompt }],
        max_tokens: maxOutputTokens,
        temperature: 0,
        stream: false,
        provider: { require_parameters: true },
        response_format: buildOpenAiResponseFormat(profile, input.structuredOutputSchema),
      };
      break;
    }
    case "openai-compatible": {
      headers.authorization = `Bearer ${input.credential}`;
      if (input.productId === "qwen" && input.workspaceAccountId) {
        headers["x-dashscope-workspace"] = input.workspaceAccountId;
      }
      body = {
        model: input.evidenceKey.modelId,
        messages: [{ role: "user", content: input.prompt }],
        max_tokens: maxOutputTokens,
        temperature: 0,
        stream: false,
        response_format: buildOpenAiResponseFormat(profile, input.structuredOutputSchema),
      };
      break;
    }
  }

  return boundedFetchInit({
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal: input.signal,
  });
}

function resolveUsageAvailability(
  productId: HostedApiProductId,
  usage: NormalizedUsage | null,
): UsageAvailability {
  const contract = profileFor(productId).usageContract;
  if (usage) return "reported";
  return contract === "required-terminal" ? "required-missing" : "unavailable";
}

function parseProviderPayload(
  productId: HostedApiProductId,
  payload: unknown,
): Readonly<{ content: string | null; usage: NormalizedUsage | null }> {
  const profile = profileFor(productId);
  switch (profile.wireFamily) {
    case "google":
      return {
        content: extractGoogleContent(payload),
        usage: normalizeGoogleUsage(
          payload && typeof payload === "object"
            ? (payload as Record<string, unknown>).usageMetadata
            : null,
        ),
      };
    case "openrouter":
    case "openai-compatible":
      return {
        content: extractOpenAiContent(payload),
        usage: normalizeOpenAiUsage(
          payload && typeof payload === "object"
            ? (payload as Record<string, unknown>).usage
            : null,
        ),
      };
  }
}

function isAbortError(error: unknown): boolean {
  return (
    (error instanceof DOMException && error.name === "AbortError") ||
    (error instanceof Error && error.name === "AbortError")
  );
}

function isRedirectError(error: unknown): boolean {
  return error instanceof TypeError && /redirect/i.test(error.message);
}

function validateNoticeVersion(productId: HostedApiProductId, noticeVersion: number): boolean {
  const product = PRODUCT_REGISTRY[productId];
  return product.kind === "runnable" && product.notice.noticeVersion === noticeVersion;
}

export async function executeHostedReview(request: HostedExecuteRequest): Promise<ExecutionResult> {
  const { evidenceKey, context } = request;
  const productId = evidenceKey.productId;
  if (!(HOSTED_API_PRODUCT_IDS as readonly string[]).includes(productId)) {
    return failedResult(request, "transport-failed", {
      attemptCount: 0,
      startedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString(),
    });
  }

  const hostedProductId = productId as HostedApiProductId;
  const profile = profileFor(hostedProductId);
  const now = context.now ?? (() => new Date());
  const startedAt = now().toISOString();

  if (evidenceKey.transportFamily !== "hosted-api") {
    return failedResult(request, "transport-failed", {
      attemptCount: 0,
      startedAt,
      finishedAt: now().toISOString(),
    });
  }

  if (!validateNoticeVersion(hostedProductId, evidenceKey.noticeVersion)) {
    return failedResult(request, "transport-failed", {
      attemptCount: 0,
      startedAt,
      finishedAt: now().toISOString(),
    });
  }

  const endpointResult = validateHostedEndpoint({
    productId: hostedProductId,
    endpoint: evidenceKey.normalizedEndpoint ?? "",
    region: evidenceKey.region ?? undefined,
    workspace:
      evidenceKey.workspaceAccountReference === null
        ? undefined
        : (context.workspaceAccountId ?? undefined),
  });
  if (!endpointResult.ok) {
    return failedResult(request, "transport-failed", {
      attemptCount: 0,
      startedAt,
      finishedAt: now().toISOString(),
    });
  }

  if (!context.credential) {
    return failedResult(request, "transport-failed", {
      attemptCount: 0,
      startedAt,
      finishedAt: now().toISOString(),
    });
  }

  if (
    profile.structuredOutput === "strict-json-schema" &&
    context.structuredOutputSchema === undefined
  ) {
    return failedResult(request, "transport-failed", {
      attemptCount: 0,
      startedAt,
      finishedAt: now().toISOString(),
    });
  }

  const ledger = context.budgetLedger;
  let reservation: BudgetReservation | null = null;
  const estimate = attemptEstimate(request.prompt, evidenceKey.limits);
  const releaseAttempt = () => {
    if (ledger && reservation) {
      ledger.releaseReservation(reservation);
      reservation = null;
    }
  };

  const fetcher = createResponseLimitingFetch(context.fetch ?? globalThis.fetch);
  // A provider profile may ask for a malformed-output retry, but the admitted
  // limits are the ceiling: `maxRetries: 0` means exactly one attempt.
  const maxAttempts = Math.min(
    profile.malformedOutputRetry ? 2 : 1,
    evidenceKey.limits.maxRetries + 1,
  );
  let attemptCount = 0;
  let lastUsageAvailability: UsageAvailability = "unavailable";

  try {
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      if (ledger) {
        const reserve = ledger.reserveAttempt(estimate);
        if (!reserve.ok) {
          const outcome = reserve.error.outcome;
          return failedResult(request, outcome === "cancelled" ? "cancelled" : "budget-exhausted", {
            attemptCount,
            startedAt,
            finishedAt: now().toISOString(),
            usageAvailability: lastUsageAvailability,
          });
        }
        reservation = reserve.value;
      }
      attemptCount += 1;
      if (request.signal?.aborted) {
        return failedResult(request, "cancelled", {
          attemptCount,
          startedAt,
          finishedAt: now().toISOString(),
          usageAvailability: lastUsageAvailability,
        });
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
        limits: evidenceKey.limits,
        structuredOutputSchema: context.structuredOutputSchema,
        workspaceAccountId: context.workspaceAccountId,
        signal: request.signal,
      });

      let response: Response;
      try {
        response = await fetcher(url, init);
      } catch (error) {
        if (isAbortError(error)) {
          return failedResult(request, "cancelled", {
            attemptCount,
            startedAt,
            finishedAt: now().toISOString(),
            usageAvailability: lastUsageAvailability,
          });
        }
        if (isRedirectError(error)) {
          return failedResult(request, "transport-failed", {
            attemptCount,
            startedAt,
            finishedAt: now().toISOString(),
            usageAvailability: lastUsageAvailability,
          });
        }
        return failedResult(request, "transport-failed", {
          attemptCount,
          startedAt,
          finishedAt: now().toISOString(),
          usageAvailability: lastUsageAvailability,
        });
      }

      if (response.status === 429) {
        const captured = await readTextResponseWithLimit(
          response,
          Math.min(evidenceKey.limits.maxResponseBytes, RATE_LIMIT_DIAGNOSTIC_MAX_BYTES),
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
        return failedResult(request, "transport-failed", {
          attemptCount,
          startedAt,
          finishedAt: now().toISOString(),
          usageAvailability: lastUsageAvailability,
        });
      }

      if (!response.ok) {
        return failedResult(request, "transport-failed", {
          attemptCount,
          startedAt,
          finishedAt: now().toISOString(),
          usageAvailability: lastUsageAvailability,
        });
      }

      const bodyResult = await readTextResponseWithLimit(
        response,
        evidenceKey.limits.maxResponseBytes,
        "Hosted provider",
      );
      if (!bodyResult.ok) {
        return failedResult(request, "transport-failed", {
          attemptCount,
          startedAt,
          finishedAt: now().toISOString(),
          usageAvailability: lastUsageAvailability,
        });
      }

      let payload: unknown;
      try {
        payload = JSON.parse(bodyResult.value);
      } catch {
        return failedResult(request, "schema-failed", {
          attemptCount,
          startedAt,
          finishedAt: now().toISOString(),
          usageAvailability: lastUsageAvailability,
        });
      }

      const parsed = parseProviderPayload(hostedProductId, payload);
      const usageAvailability = resolveUsageAvailability(hostedProductId, parsed.usage);
      lastUsageAvailability = usageAvailability;

      if (usageAvailability === "required-missing") {
        return failedResult(request, "transport-failed", {
          attemptCount,
          startedAt,
          finishedAt: now().toISOString(),
          usageAvailability,
        });
      }

      if (!parsed.content) {
        if (profile.malformedOutputRetry && attempt + 1 < maxAttempts) {
          releaseAttempt();
          continue;
        }
        return failedResult(request, "schema-failed", {
          attemptCount,
          startedAt,
          finishedAt: now().toISOString(),
          usage: parsed.usage ?? undefined,
          usageAvailability,
        });
      }

      let reviewPayload: unknown;
      try {
        reviewPayload = JSON.parse(parsed.content);
      } catch {
        if (profile.malformedOutputRetry && attempt + 1 < maxAttempts) {
          releaseAttempt();
          continue;
        }
        return failedResult(request, "schema-failed", {
          attemptCount,
          startedAt,
          finishedAt: now().toISOString(),
          usage: parsed.usage ?? undefined,
          usageAvailability,
        });
      }

      const validated = context.reviewSchema.safeParse(reviewPayload);
      if (!validated.success) {
        if (profile.malformedOutputRetry && attempt + 1 < maxAttempts) {
          releaseAttempt();
          continue;
        }
        return failedResult(request, "schema-failed", {
          attemptCount,
          startedAt,
          finishedAt: now().toISOString(),
          usage: parsed.usage ?? undefined,
          usageAvailability,
        });
      }

      if (ledger && reservation) {
        const settle = ledger.settleAttempt(reservation, {
          inputTokens: parsed.usage?.inputTokens ?? estimate.inputTokens,
          outputTokens: parsed.usage?.outputTokens ?? 0,
          responseBytes: new TextEncoder().encode(bodyResult.value).byteLength,
          wallTimeMs: Math.max(0, Date.parse(now().toISOString()) - Date.parse(startedAt)),
          costUsd: 0,
        });
        reservation = null;
        if (!settle.ok) {
          return failedResult(request, "budget-exhausted", {
            attemptCount,
            startedAt,
            finishedAt: now().toISOString(),
            usageAvailability,
          });
        }
      }

      return createCompletedExecutionResult(request, validated.data as ReviewResult, {
        attemptCount,
        startedAt,
        finishedAt: now().toISOString(),
        usage: parsed.usage ?? undefined,
        usageAvailability,
      });
    }

    return failedResult(request, "schema-failed", {
      attemptCount,
      startedAt,
      finishedAt: now().toISOString(),
      usageAvailability: lastUsageAvailability,
    });
  } finally {
    if (ledger && reservation) {
      ledger.releaseReservation(reservation);
    }
  }
}

/**
 * Production wiring for every hosted adapter: the credential arrives through the
 * authorized execution channel carried on the request, never from module state.
 * A request without that channel — an unauthorized dispatch — resolves no
 * context and the adapter fails closed.
 */
const AUTHORIZED_HOSTED_DEPENDENCIES: HostedAdapterDependencies = {
  async resolveContext(request) {
    const credential = await request.resolveCredential?.();
    if (!credential) return null;
    return {
      credential,
      reviewSchema: DEFAULT_HOSTED_REVIEW_SCHEMA,
      structuredOutputSchema: REVIEW_RESULT_JSON_SCHEMA,
      workspaceAccountId: request.workspaceAccountId ?? null,
    };
  },
};

export function createHostedAdapter(
  productId: HostedApiProductId,
  dependencies: HostedAdapterDependencies = AUTHORIZED_HOSTED_DEPENDENCIES,
): Adapter {
  const transportFamily = PRODUCT_REGISTRY[productId].transportFamily;
  return {
    productId,
    transportFamily,
    async execute(request) {
      const context = await dependencies.resolveContext(request);
      if (!context) {
        return failedResult(request, "transport-failed", {
          attemptCount: 0,
          startedAt: new Date().toISOString(),
          finishedAt: new Date().toISOString(),
        });
      }

      return executeHostedReview({ ...request, context });
    },
  };
}

export const HOSTED_ADAPTERS = Object.fromEntries(
  HOSTED_API_PRODUCT_IDS.map((productId) => [productId, createHostedAdapter(productId)]),
) as Record<HostedApiProductId, Adapter>;
