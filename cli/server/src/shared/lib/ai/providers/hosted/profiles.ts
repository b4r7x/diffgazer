import type { HostedApiProductId } from "@diffgazer/core/schemas/config";
import { buildProviderLensReviewResultJsonSchema } from "@diffgazer/core/schemas/review";
import type { DispatchPacing, HostedProductProfile } from "./types.js";

export const HOSTED_PROFILES = {
  gemini: {
    wireFamily: "google",
    structuredOutput: "strict-json-schema",
    malformedOutputRetry: false,
  },
  zai: {
    wireFamily: "openai-compatible",
    structuredOutput: "json-object-local-validation",
    malformedOutputRetry: true,
    // provisional — single probe, 2026-08-25: one ~39k-input call took 112s.
    pacing: { perDispatchWallTimeMs: 300_000 },
  },
  openrouter: {
    wireFamily: "openrouter",
    structuredOutput: "strict-json-schema",
    // Strict dispatch travels with provider.require_parameters, which hard-404s
    // any route that does not declare structured_outputs (the gateway only
    // drops an unsupported response_format when nothing requires it). Dispatch
    // therefore degrades such routes per model to JSON mode with local
    // validation, where one malformed object is possible; retry once, like the
    // json-object products.
    malformedOutputRetry: true,
    // Gateway with invisible free-pool queueing: one window must fit queue
    // wait, an unbounded/bounded reasoning generation, and a corrective retry.
    // Field evidence 2026-08-26: a healthy free-route reasoning call alone ran
    // 180-300s, so the generic 300s budget wall timed out real work.
    // Non-streaming (wire.ts `stream: false`): the gateway commits 200 +
    // headers on provider accept and the JSON body is the whole generation, so
    // the keep-alive whitespace after the headers IS generation time (probed
    // 2026-09-02: an 11-byte whitespace chunk every ≈420 ms) — only answer
    // bytes count as progress. The idle budget must clear
    // the slowest healthy answer on record — the 180-300s free-route reasoning
    // call above — and still leave the one-shot re-dispatch room for a whole
    // answer inside the 600s wall (execute.ts TIMEOUT_RETRY_MIN_REMAINING_MS,
    // 60s): 360s = 300s × 1.2 leaves ≈240s, twelve times the ≈20s a healthy
    // flash dispatch took in the 2026-09-02 live run whose stalled batch sat
    // silent for the full 600s. Raise it only on a healthy call observed above it.
    // The same 360s budget also bounds the pre-accept wait (headers commit on accept
    // here): a queue past it is re-dispatched once inside the 600s wall.
    pacing: { perDispatchWallTimeMs: 600_000, bodyIdleTimeoutMs: 360_000 },
    // Soft routing preference (openrouter.ai/docs/features/provider-routing,
    // fetched 2026-09-02): providers whose p99 latency is under 60s are
    // preferred; price-weighted load balancing continues among them, and a
    // model served only by slower providers still routes ("should never prevent
    // your request from being executed"). A stall is a tail event, hence p99;
    // 60s is the floor a whole healthy answer needs (TIMEOUT_RETRY_MIN_REMAINING_MS).
    routingPreferences: { preferred_max_latency: { p99: 60 } },
  },
  deepseek: {
    wireFamily: "openai-compatible",
    structuredOutput: "json-object-local-validation",
    malformedOutputRetry: true,
  },
  qwen: {
    wireFamily: "openai-compatible",
    structuredOutput: "json-object-local-validation",
    malformedOutputRetry: true,
  },
  moonshot: {
    wireFamily: "openai-compatible",
    structuredOutput: "strict-json-schema",
    malformedOutputRetry: false,
  },
  minimax: {
    wireFamily: "openai-compatible",
    structuredOutput: "json-object-local-validation",
    // The platform silently ignores response_format on M-series, so a
    // non-enforcing route can emit one malformed object; retry once, like the
    // other json-object products.
    malformedOutputRetry: true,
  },
  "ollama-cloud": {
    wireFamily: "openai-compatible",
    structuredOutput: "json-object-local-validation",
    malformedOutputRetry: true,
  },
  "opencode-zen": {
    wireFamily: "openai-compatible",
    structuredOutput: "json-object-local-validation",
    malformedOutputRetry: true,
    // Probed 2026-09-03 (70+ stream:false runs): Zen sends no keep-alive at all
    // (0 whitespace chunks) and commits headers only when generation ends
    // (headersMs ≈ endMs on every completed run), so this budget bounds the
    // HEADERS phase. Slowest healthy review-sized answer on record with the
    // reasoning control on the wire: glm-5.3-flash 75.1s on /zen/go/v1
    // (qwen3.8-flash 21.6s, deepseek-v4-flash 49.4s/11.6s) — 120s = ×1.6, and the
    // one-shot re-dispatch keeps 180s of the 300s wall. Raise it only on a healthy
    // call observed above it.
    pacing: { perDispatchWallTimeMs: 300_000, bodyIdleTimeoutMs: 120_000 },
  },
} as const satisfies Record<HostedApiProductId, HostedProductProfile>;

const MODEL_PACING_OVERRIDES: Partial<
  Record<
    HostedApiProductId,
    ReadonlyArray<Readonly<{ modelIdPrefix: string; pacing: DispatchPacing }>>
  >
> = {
  zai: [
    // Z.AI documents one concurrent request for the free Flash models; paid
    // models publish no concurrency limit and are not clamped.
    { modelIdPrefix: "glm-4.5-flash", pacing: { maxParallelDispatches: 1 } },
    { modelIdPrefix: "glm-4.7-flash", pacing: { maxParallelDispatches: 1 } },
    // provisional — single free-tier probe, 2026-08-25: glm-5.2 under a completion
    // cap spent its whole output budget on reasoning tokens.
    { modelIdPrefix: "glm-5", pacing: { reasoning: "may-reason" } },
  ],
};

export type ReasoningEffort = "none" | "low";

/**
 * Reasoning control sent on the openai-compatible wire, per product and exact
 * model id — only where a live call with the wire's own stream:false shape
 * returned 200 / finish_reason "stop" inside the product's budget at review
 * size (evidence = probe row ids, .nuke/2026-09-03-091500-spec-zen-stall/probe).
 * Without it these thinking-by-default models reason for minutes and a
 * non-streaming gateway holds the request pre-headers. Mirrors the OpenRouter
 * `reasoning.max_tokens` bound and Gemini's thinkingBudget: per family, sent
 * only where it is known to be honoured. Not user-configurable.
 * Not listed on purpose: ollama-cloud glm-5.3-flash / deepseek-v4-flash:0731
 * (HTTP 402 on the probing account, so the field is unprobed there); gpt-oss:20b
 * (answers plain; "low" measured 7.9s vs 84s and 18.8s at review size — deferred,
 * it is the gate's last-resort fallback, not a primary); the `deepseek` product
 * (api.deepseek.com is unprobed and documents a different
 * disable field); every `reasoning_effort:"none"` on a GLM route (HTTP 400
 * [1210] on Z.AI, HTTP 400 "Reasoning is mandatory" on OpenRouter).
 */
export const REASONING_EFFORT_OVERRIDES: Partial<
  Record<
    HostedApiProductId,
    ReadonlyArray<Readonly<{ modelId: string; reasoningEffort: ReasoningEffort; evidence: string }>>
  >
> = {
  "opencode-zen": [
    {
      modelId: "qwen3.8-flash",
      reasoningEffort: "none",
      evidence:
        "go-sized-qwen38 rep1 21.6s (6000w); flashx-go-qwen3.8-flash-noreason-effortnone 8.3s",
    },
    {
      modelId: "glm-5.3-flash",
      reasoningEffort: "low",
      evidence:
        "go-sized-glm53 rep1 75.1s (6000w); flashns-go-glm-5.3-flash-effortlow rep1/rep2 40.6s/30.9s",
    },
    {
      modelId: "deepseek-v4-flash",
      reasoningEffort: "none",
      evidence:
        "dsv1-sized-effortnone rep1 49.4s (/zen/v1, 6000w); go-sized-ds rep1 11.6s (/zen/go/v1, 6000w); dsv1-effortnone 10.2s, -confirm 5.9s/5.8s",
    },
  ],
  zai: [
    {
      modelId: "glm-5.3-flash",
      reasoningEffort: "low",
      evidence: "zai-sized-glm53-effort-low rep1 23.1s (6000w); zai-glm53-effort-low rep1 26.4s",
    },
  ],
};

export function resolveReasoningEffort(
  productId: HostedApiProductId,
  modelId: string,
): ReasoningEffort | undefined {
  return REASONING_EFFORT_OVERRIDES[productId]?.find((entry) => entry.modelId === modelId)
    ?.reasoningEffort;
}

export function resolveDispatchPacing(productId: string, modelId: string): DispatchPacing {
  if (!Object.hasOwn(HOSTED_PROFILES, productId)) return {};
  const hostedProductId = productId as HostedApiProductId;
  const profile: HostedProductProfile = HOSTED_PROFILES[hostedProductId];
  const productPacing = profile.pacing ?? {};
  const override = MODEL_PACING_OVERRIDES[hostedProductId]?.find((entry) =>
    modelId.startsWith(entry.modelIdPrefix),
  );
  return override ? { ...productPacing, ...override.pacing } : productPacing;
}

export const HTTP_DIAGNOSTIC_MAX_BYTES = 64 * 1024;

export const USAGE_FIELDS = [
  "inputTokens",
  "outputTokens",
  "totalTokens",
  "cachedTokens",
  "reasoningTokens",
] as const;

export function hostedStructuredOutputSchema(
  productId: HostedApiProductId,
): Record<string, unknown> {
  return buildProviderLensReviewResultJsonSchema(HOSTED_PROFILES[productId].wireFamily);
}
