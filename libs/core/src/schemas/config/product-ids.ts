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
  "gemini",
  "zai",
  "openrouter",
  "groq",
  "cerebras",
  "deepseek",
  "ollama-cloud",
  "opencode-zen",
] as const;
export const HostedApiProductIdSchema = z.enum(HOSTED_API_PRODUCT_IDS);
export type HostedApiProductId = z.infer<typeof HostedApiProductIdSchema>;

export const LOCAL_HTTP_PRODUCT_IDS = ["ollama", "local-openai"] as const;
export const LocalHttpProductIdSchema = z.enum(LOCAL_HTTP_PRODUCT_IDS);
export type LocalHttpProductId = z.infer<typeof LocalHttpProductIdSchema>;

export const LOCAL_CLI_PRODUCT_IDS = ["codex-cli", "copilot-cli"] as const;
export const LocalCliProductIdSchema = z.enum(LOCAL_CLI_PRODUCT_IDS);
export type LocalCliProductId = z.infer<typeof LocalCliProductIdSchema>;

export const RUNNABLE_PRODUCT_IDS = [
  ...HOSTED_API_PRODUCT_IDS,
  ...LOCAL_HTTP_PRODUCT_IDS,
  ...LOCAL_CLI_PRODUCT_IDS,
] as const;
export const RunnableProductIdSchema = z.enum(RUNNABLE_PRODUCT_IDS);
export type RunnableProductId = z.infer<typeof RunnableProductIdSchema>;

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
  "minimax-payg",
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
