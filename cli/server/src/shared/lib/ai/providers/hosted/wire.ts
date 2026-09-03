import type { HostedApiProductId } from "@diffgazer/core/schemas/config";
import type { EvidenceKey, NormalizedUsage } from "@diffgazer/core/schemas/review";
import { NormalizedUsageSchema } from "@diffgazer/core/schemas/review";
import { boundedFetchInit } from "../endpoints.js";
import { responseTimeoutDispatcher } from "./dispatcher.js";
import {
  HOSTED_PROFILES,
  resolveDispatchPacing,
  resolveReasoningEffort,
  USAGE_FIELDS,
} from "./profiles.js";
import type { HostedProductProfile } from "./types.js";

/**
 * Thinking tokens bill as output, so an uncapped thinking model can spend most
 * of the model's output ceiling on thought before emitting the structured
 * answer. 2_048 caps thought spend while leaving room for the answer. The
 * Gemini 2.5 Pro API minimum for this field is 128, so this must stay >= 128.
 * The value is an owner-tunable quality/cost trade.
 */
const GEMINI_THINKING_BUDGET_TOKENS = 2_048;

/**
 * OpenRouter's cross-provider reasoning bound (`reasoning.max_tokens`,
 * Anthropic-style token allocation; verified against the OpenRouter reasoning
 * docs 2026-08). Same trade as the Gemini budget above: reasoning bills as
 * output, and a reasoning-default route with no bound has been observed
 * spending its entire completion budget on thought and returning zero content
 * tokens. Sent only for routes whose live list declares the `reasoning`
 * parameter, so non-reasoning routes are never narrowed by it under
 * `require_parameters`.
 */
const OPENROUTER_REASONING_BUDGET_TOKENS = 2_048;

/** Gemini 2.5 models whose thinking is ON by default and spends the output budget. */
const GEMINI_THINKING_DEFAULT_MODELS = ["gemini-2.5-pro", "gemini-2.5-flash"] as const;

function isGeminiThinkingDefaultModel(modelId: string): boolean {
  // 2.5 Flash-Lite defaults thinking OFF; sending a budget would switch it on.
  if (modelId.includes("flash-lite")) return false;
  return GEMINI_THINKING_DEFAULT_MODELS.some(
    (base) => modelId === base || modelId.startsWith(`${base}-`),
  );
}

const USAGE_COMPONENT_FIELDS = USAGE_FIELDS.filter(
  (field): field is Exclude<(typeof USAGE_FIELDS)[number], "totalTokens"> =>
    field !== "totalTokens",
);

function hasInvalidUsageNumber(usage: Record<string, unknown>, field: string): boolean {
  if (!Object.hasOwn(usage, field)) return false;
  const value = usage[field];
  return typeof value !== "number" || !Number.isSafeInteger(value) || value < 0;
}

function hasInvalidNestedUsageNumber(
  usage: Record<string, unknown>,
  field: string,
  nestedField: string,
): boolean {
  if (!Object.hasOwn(usage, field) || usage[field] === null || usage[field] === undefined) {
    return false;
  }
  const nested = usage[field];
  return (
    typeof nested !== "object" ||
    hasInvalidUsageNumber(nested as Record<string, unknown>, nestedField)
  );
}

export function accumulateUsage(
  total: NormalizedUsage | null,
  attempt: NormalizedUsage | null,
): NormalizedUsage | null {
  if (!attempt) return total ? normalizeUsage(total) : null;
  if (!total) return normalizeUsage(attempt);
  const merged: Record<string, number> = {};
  for (const field of USAGE_COMPONENT_FIELDS) {
    const left = total[field];
    const right = attempt[field];
    if (left === undefined && right === undefined) continue;
    merged[field] = (left ?? 0) + (right ?? 0);
  }

  // A provider may omit total tokens even when it reports both input and
  // output. Keep that attempt in the aggregate and derive only the value that
  // is mechanically determined by the two known components. Never derive a
  // missing input/output component from a total.
  if (merged.inputTokens !== undefined && merged.outputTokens !== undefined) {
    merged.totalTokens = merged.inputTokens + merged.outputTokens;
  }
  return normalizeUsage(merged);
}

function normalizeUsage(
  normalized: Readonly<{
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
    cachedTokens?: number;
    reasoningTokens?: number;
  }>,
): NormalizedUsage | null {
  // Validate the complete provider record before dropping its total. This
  // preserves the schema's contradiction checks for partial reports (for
  // example total < cached/reasoning), while keeping total out of the
  // additive accounting dimensions below.
  const providerParsed = NormalizedUsageSchema.safeParse(normalized);
  if (!providerParsed.success) return null;

  // Provider totals are not an independent accounting dimension. Drop them
  // unless both components needed to derive a consistent total are known.
  // This makes a total-only response unavailable instead of treating it as
  // retry-safe or summing it a second time with later component usage.
  const { totalTokens: _providerTotal, ...components } = providerParsed.data;
  const withDerivedTotal =
    components.inputTokens !== undefined && components.outputTokens !== undefined
      ? { ...components, totalTokens: components.inputTokens + components.outputTokens }
      : components;
  const parsed = NormalizedUsageSchema.safeParse(withDerivedTotal);
  return parsed.success ? parsed.data : null;
}

function normalizeOpenAiUsage(raw: unknown): NormalizedUsage | null {
  if (!raw || typeof raw !== "object") return null;
  const usage = raw as Record<string, unknown>;
  if (
    ["prompt_tokens", "completion_tokens", "total_tokens"].some((field) =>
      hasInvalidUsageNumber(usage, field),
    ) ||
    hasInvalidNestedUsageNumber(usage, "prompt_tokens_details", "cached_tokens") ||
    hasInvalidNestedUsageNumber(usage, "completion_tokens_details", "reasoning_tokens")
  ) {
    return null;
  }
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

  const normalized = {
    ...(inputTokens !== undefined ? { inputTokens } : {}),
    ...(outputTokens !== undefined ? { outputTokens } : {}),
    ...(totalTokens !== undefined ? { totalTokens } : {}),
    ...(cachedTokens !== undefined ? { cachedTokens } : {}),
    ...(reasoningTokens !== undefined ? { reasoningTokens } : {}),
  };
  return normalizeUsage(normalized);
}

function normalizeGoogleUsage(raw: unknown): NormalizedUsage | null {
  if (!raw || typeof raw !== "object") return null;
  const usage = raw as Record<string, unknown>;
  if (
    [
      "promptTokenCount",
      "candidatesTokenCount",
      "thoughtsTokenCount",
      "totalTokenCount",
      "cachedContentTokenCount",
    ].some((field) => hasInvalidUsageNumber(usage, field))
  ) {
    return null;
  }
  const inputTokens =
    typeof usage.promptTokenCount === "number" ? usage.promptTokenCount : undefined;
  const candidateTokens =
    typeof usage.candidatesTokenCount === "number" ? usage.candidatesTokenCount : undefined;
  const thoughtsTokenCount =
    typeof usage.thoughtsTokenCount === "number" ? usage.thoughtsTokenCount : undefined;
  const outputTokens =
    candidateTokens === undefined && thoughtsTokenCount === undefined
      ? undefined
      : (candidateTokens ?? 0) + (thoughtsTokenCount ?? 0);
  const totalTokens = typeof usage.totalTokenCount === "number" ? usage.totalTokenCount : undefined;
  const cachedTokens =
    typeof usage.cachedContentTokenCount === "number" ? usage.cachedContentTokenCount : undefined;
  const reasoningTokens = thoughtsTokenCount;

  const normalized = {
    ...(inputTokens !== undefined ? { inputTokens } : {}),
    ...(outputTokens !== undefined ? { outputTokens } : {}),
    ...(totalTokens !== undefined ? { totalTokens } : {}),
    ...(cachedTokens !== undefined ? { cachedTokens } : {}),
    ...(reasoningTokens !== undefined ? { reasoningTokens } : {}),
  };
  return normalizeUsage(normalized);
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

/**
 * OpenRouter embeds an upstream provider's mid-generation failure as an
 * `error` object on the final choice (non-streaming), beside any partial
 * content. Its presence is transport evidence, whatever the finish reason says.
 */
function extractOpenAiChoiceError(payload: unknown): ChoiceError | null {
  if (!payload || typeof payload !== "object") return null;
  const choices = (payload as Record<string, unknown>).choices;
  if (!Array.isArray(choices) || choices.length === 0) return null;
  const first = choices[0];
  if (!first || typeof first !== "object") return null;
  const error = (first as Record<string, unknown>).error;
  if (!error || typeof error !== "object") return null;
  const { code, message } = error as { code?: unknown; message?: unknown };
  return {
    code: typeof code === "string" || typeof code === "number" ? String(code) : null,
    message: typeof message === "string" ? message : null,
  };
}

function extractOpenAiChoiceString(payload: unknown, field: string): string | null {
  if (!payload || typeof payload !== "object") return null;
  const choices = (payload as Record<string, unknown>).choices;
  if (!Array.isArray(choices) || choices.length === 0) return null;
  const first = choices[0];
  if (!first || typeof first !== "object") return null;
  const value = (first as Record<string, unknown>)[field];
  return typeof value === "string" ? value : null;
}

function extractGoogleFinishReason(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const candidates = (payload as Record<string, unknown>).candidates;
  if (!Array.isArray(candidates) || candidates.length === 0) return null;
  const first = candidates[0];
  if (!first || typeof first !== "object") return null;
  const finishReason = (first as Record<string, unknown>).finishReason;
  return typeof finishReason === "string" ? finishReason : null;
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
  structuredOutput: HostedProductProfile["structuredOutput"],
  structuredOutputSchema?: Record<string, unknown>,
): Record<string, unknown> | undefined {
  if (structuredOutput === "json-object-local-validation") {
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

export function buildRequestUrl(
  productId: HostedApiProductId,
  endpoint: string,
  modelId: string,
): string {
  const profile = HOSTED_PROFILES[productId];
  switch (profile.wireFamily) {
    case "google":
      return `${endpoint}/models/${encodeURIComponent(modelId)}:generateContent`;
    case "openrouter":
    case "openai-compatible":
      return `${endpoint}/chat/completions`;
  }
}

/**
 * A corrective retry replays the failed answer as an assistant turn and asks
 * for the fix, instead of blindly repeating the identical temperature-0
 * request that already produced it.
 */
export type OutputCorrection = Readonly<{
  failedOutput: string;
  instruction: string;
}>;

function buildOpenAiMessages(
  prompt: string,
  systemPrompt: string | undefined,
  correction: OutputCorrection | undefined,
): Array<Record<string, string>> {
  return [
    ...(systemPrompt ? [{ role: "system", content: systemPrompt }] : []),
    { role: "user", content: prompt },
    ...(correction
      ? [
          { role: "assistant", content: correction.failedOutput },
          { role: "user", content: correction.instruction },
        ]
      : []),
  ];
}

export function buildRequestInit(
  input: Readonly<{
    productId: HostedApiProductId;
    credential: string;
    evidenceKey: EvidenceKey;
    prompt: string;
    systemPrompt?: string;
    structuredOutputSchema?: Record<string, unknown>;
    structuredOutputMode?: HostedProductProfile["structuredOutput"];
    boundReasoning?: boolean;
    correction?: OutputCorrection;
    signal?: AbortSignal;
  }>,
): RequestInit {
  const profile = HOSTED_PROFILES[input.productId];
  const structuredOutput = input.structuredOutputMode ?? profile.structuredOutput;
  const headers: Record<string, string> = {
    "content-type": "application/json",
    accept: "application/json",
  };

  let body: Record<string, unknown>;

  switch (profile.wireFamily) {
    case "google": {
      headers["x-goog-api-key"] = input.credential;
      body = {
        contents: [
          { role: "user", parts: [{ text: input.prompt }] },
          ...(input.correction
            ? [
                { role: "model", parts: [{ text: input.correction.failedOutput }] },
                { role: "user", parts: [{ text: input.correction.instruction }] },
              ]
            : []),
        ],
        ...(input.systemPrompt
          ? { systemInstruction: { parts: [{ text: input.systemPrompt }] } }
          : {}),
        generationConfig: {
          temperature: 0,
          responseMimeType: "application/json",
          ...(isGeminiThinkingDefaultModel(input.evidenceKey.modelId)
            ? { thinkingConfig: { thinkingBudget: GEMINI_THINKING_BUDGET_TOKENS } }
            : {}),
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
        messages: buildOpenAiMessages(input.prompt, input.systemPrompt, input.correction),
        temperature: 0,
        stream: false,
        ...(input.boundReasoning
          ? { reasoning: { max_tokens: OPENROUTER_REASONING_BUDGET_TOKENS } }
          : {}),
        // require_parameters pins routing to endpoints that support every
        // requested parameter. It is only sent alongside the strict schema:
        // demanding it for JSON mode would 404 routes that lack response_format
        // instead of letting the gateway drop it, and local validation covers
        // the output either way.
        provider: {
          ...profile.routingPreferences,
          ...(structuredOutput === "strict-json-schema" ? { require_parameters: true } : {}),
        },
        response_format: buildOpenAiResponseFormat(structuredOutput, input.structuredOutputSchema),
      };
      break;
    }
    case "openai-compatible": {
      headers.authorization = `Bearer ${input.credential}`;
      const reasoningEffort = resolveReasoningEffort(input.productId, input.evidenceKey.modelId);
      body = {
        model: input.evidenceKey.modelId,
        messages: buildOpenAiMessages(input.prompt, input.systemPrompt, input.correction),
        temperature: 0,
        stream: false,
        response_format: buildOpenAiResponseFormat(structuredOutput, input.structuredOutputSchema),
        ...(reasoningEffort === undefined ? {} : { reasoning_effort: reasoningEffort }),
      };
      break;
    }
  }

  return {
    ...boundedFetchInit({
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: input.signal,
    }),
    // With a declared idle budget the client's headers timeout is that budget, so a
    // gateway that commits headers only when generation ends is re-dispatched inside
    // the wall; without one it outlives the wall, so the wall names the failure.
    dispatcher: responseTimeoutDispatcher(
      input.evidenceKey.limits.wallTimeMs,
      resolveDispatchPacing(input.productId, input.evidenceKey.modelId).bodyIdleTimeoutMs,
    ),
  };
}

type ChoiceError = Readonly<{ code: string | null; message: string | null }>;

type ParsedProviderPayload = Readonly<{
  content: string | null;
  usage: NormalizedUsage | null;
  finishReason: string | null;
  /** The upstream provider's own mid-generation failure, embedded on the choice. */
  choiceError: ChoiceError | null;
  /**
   * OpenRouter's untranslated upstream finish reason. The normalized
   * `finish_reason` has been observed hiding a completion-cap stop that
   * `native_finish_reason` still names, so length detection reads both.
   */
  nativeFinishReason: string | null;
}>;

export function parseProviderPayload(
  productId: HostedApiProductId,
  payload: unknown,
): ParsedProviderPayload {
  const profile = HOSTED_PROFILES[productId];
  switch (profile.wireFamily) {
    case "google": {
      return {
        content: extractGoogleContent(payload),
        usage: normalizeGoogleUsage(
          payload && typeof payload === "object"
            ? (payload as Record<string, unknown>).usageMetadata
            : null,
        ),
        finishReason: extractGoogleFinishReason(payload),
        nativeFinishReason: null,
        choiceError: null,
      };
    }
    case "openrouter":
    case "openai-compatible": {
      return {
        content: extractOpenAiContent(payload),
        usage: normalizeOpenAiUsage(
          payload && typeof payload === "object"
            ? (payload as Record<string, unknown>).usage
            : null,
        ),
        finishReason: extractOpenAiChoiceString(payload, "finish_reason"),
        nativeFinishReason: extractOpenAiChoiceString(payload, "native_finish_reason"),
        choiceError: extractOpenAiChoiceError(payload),
      };
    }
  }
}
