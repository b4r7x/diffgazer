import type { HostedApiProductId } from "@diffgazer/core/schemas/config";
import { buildProviderLensReviewResultJsonSchema } from "@diffgazer/core/schemas/review";
import type { HostedProductProfile } from "./types.js";

export const HOSTED_PROFILES = {
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
  "ollama-cloud": {
    wireFamily: "openai-compatible",
    structuredOutput: "json-object-local-validation",
    usageContract: "optional",
    malformedOutputRetry: true,
  },
  "opencode-zen": {
    wireFamily: "openai-compatible",
    structuredOutput: "json-object-local-validation",
    usageContract: "optional",
    malformedOutputRetry: true,
  },
} as const satisfies Record<HostedApiProductId, HostedProductProfile>;

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
