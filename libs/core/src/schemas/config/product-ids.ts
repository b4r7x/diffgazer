import { z } from "zod";

/**
 * Product and transport identity: the tuples every other module derives its
 * product vocabulary from. This is a dependency leaf so the transport schemas
 * and the product registry can both own their own policy while sharing one
 * identity authority instead of maintaining parallel id lists.
 */

export const TRANSPORT_FAMILIES = ["hosted-api", "local-http", "local-cli"] as const;
export const TransportFamilySchema = z.enum(TRANSPORT_FAMILIES);
export type TransportFamily = z.infer<typeof TransportFamilySchema>;

export const HOSTED_API_PRODUCT_IDS = [
  "ollama-cloud",
  "openrouter",
  "opencode-zen",
  "deepseek",
  "zai",
  "qwen",
  "minimax",
  "moonshot",
  "gemini",
] as const;
export const HostedApiProductIdSchema = z.enum(HOSTED_API_PRODUCT_IDS);
export type HostedApiProductId = z.infer<typeof HostedApiProductIdSchema>;

// Every runnable product is hosted today; the local-http and local-cli family
// strings survive only as candidate metadata (`candidate-verdicts.ts`).
export const RUNNABLE_PRODUCT_IDS = HOSTED_API_PRODUCT_IDS;
export const RunnableProductIdSchema = HostedApiProductIdSchema;
export type RunnableProductId = HostedApiProductId;

export const EXPERIMENTAL_PRODUCT_IDS = [
  "xiaomi-mimo",
  "byteplus-modelark",
  "cloudflare-workers-ai",
  "vllm",
  "minimax-token-plan",
  "kimi-code-cli",
  "kiro-cli",
  "cursor-agent-cli",
] as const;

export const DEFERRED_PRODUCT_IDS = [
  "tencent-hunyuan-tokenhub",
  "opencode-cli",
  "hugging-face-inference-providers",
  "together-ai",
  "fireworks-ai",
  "remote-custom-url",
  "compatible-api-vendor-sdk",
] as const;

export const REJECTED_PRODUCT_IDS = [
  "kimi-code-http",
  "alibaba-coding-plan",
  "byteplus-coding-plan",
  "volcengine-ark",
  "gemini-cli",
  "claude-code",
  "github-models",
  "nvidia-api-catalog",
  "sdk-product-registry",
] as const;

export const CANDIDATE_PRODUCT_IDS = [
  ...EXPERIMENTAL_PRODUCT_IDS,
  ...DEFERRED_PRODUCT_IDS,
  ...REJECTED_PRODUCT_IDS,
] as const;
export type CandidateProductId = (typeof CANDIDATE_PRODUCT_IDS)[number];
