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
    // silence after the headers IS generation time. The idle budget must clear
    // the slowest healthy answer on record — the 180-300s free-route reasoning
    // call above — and still leave the one-shot re-dispatch room for a whole
    // answer inside the 600s wall (execute.ts TIMEOUT_RETRY_MIN_REMAINING_MS,
    // 60s): 360s = 300s × 1.2 leaves ≈240s, twelve times the ≈20s a healthy
    // flash dispatch took in the 2026-09-02 live run whose stalled batch sat
    // silent for the full 600s. Raise it only on a healthy call observed above it.
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
