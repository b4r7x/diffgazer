import type { HostedApiProductId } from "@diffgazer/core/schemas/config";
import type {
  EvidenceKey,
  NormalizedUsage,
  UsageAvailability,
} from "@diffgazer/core/schemas/review";
import { NormalizedUsageSchema } from "@diffgazer/core/schemas/review";
import { boundedFetchInit } from "../endpoints.js";
import { HOSTED_PROFILES, USAGE_FIELDS } from "./profiles.js";
import type { HostedProductProfile } from "./types.js";

/**
 * Thinking tokens bill as output, so an uncapped thinking model can spend most
 * of the model's output ceiling on thought before emitting the structured
 * answer. 2_048 caps thought spend while leaving room for the answer. The
 * Gemini 2.5 Pro API minimum for this field is 128, so this must stay >= 128.
 * The value is an owner-tunable quality/cost trade.
 */
const GEMINI_THINKING_BUDGET_TOKENS = 2_048;

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

function buildOpenAiMessages(
  prompt: string,
  systemPrompt: string | undefined,
): Array<Record<string, string>> {
  return systemPrompt
    ? [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt },
      ]
    : [{ role: "user", content: prompt }];
}

export function buildRequestInit(
  input: Readonly<{
    productId: HostedApiProductId;
    credential: string;
    evidenceKey: EvidenceKey;
    prompt: string;
    systemPrompt?: string;
    structuredOutputSchema?: Record<string, unknown>;
    signal?: AbortSignal;
  }>,
): RequestInit {
  const profile = HOSTED_PROFILES[input.productId];
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
        messages: buildOpenAiMessages(input.prompt, input.systemPrompt),
        temperature: 0,
        stream: false,
        provider: { require_parameters: true },
        response_format: buildOpenAiResponseFormat(profile, input.structuredOutputSchema),
      };
      break;
    }
    case "openai-compatible": {
      headers.authorization = `Bearer ${input.credential}`;
      body = {
        model: input.evidenceKey.modelId,
        messages: buildOpenAiMessages(input.prompt, input.systemPrompt),
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

export function resolveUsageAvailability(
  productId: HostedApiProductId,
  usage: NormalizedUsage | null,
  usageFieldPresent = usage !== null,
): UsageAvailability {
  const contract = HOSTED_PROFILES[productId].usageContract;
  if (usage) return "reported";
  if (usageFieldPresent) return "unavailable";
  return contract === "required-terminal" ? "required-missing" : "unavailable";
}

type ParsedProviderPayload = Readonly<{
  content: string | null;
  usage: NormalizedUsage | null;
  usageFieldPresent: boolean;
}>;

export function parseProviderPayload(
  productId: HostedApiProductId,
  payload: unknown,
): ParsedProviderPayload {
  const profile = HOSTED_PROFILES[productId];
  switch (profile.wireFamily) {
    case "google": {
      const usageFieldPresent =
        payload !== null && typeof payload === "object" && Object.hasOwn(payload, "usageMetadata");
      return {
        content: extractGoogleContent(payload),
        usage: normalizeGoogleUsage(
          payload && typeof payload === "object"
            ? (payload as Record<string, unknown>).usageMetadata
            : null,
        ),
        usageFieldPresent,
      };
    }
    case "openrouter":
    case "openai-compatible": {
      const usageFieldPresent =
        payload !== null && typeof payload === "object" && Object.hasOwn(payload, "usage");
      return {
        content: extractOpenAiContent(payload),
        usage: normalizeOpenAiUsage(
          payload && typeof payload === "object"
            ? (payload as Record<string, unknown>).usage
            : null,
        ),
        usageFieldPresent,
      };
    }
  }
}
