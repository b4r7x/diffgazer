import type { CandidateProductId, TransportFamily } from "../schemas/config/product-ids.js";
export type CandidateVerdict = "experimental" | "deferred" | "rejected";

export interface CandidateProductVerdict<ProductId extends CandidateProductId> {
  readonly id: ProductId;
  readonly name: string;
  readonly verdict: CandidateVerdict;
  readonly runnable: false;
  readonly visibleInSetup: false;
  readonly transportFamily: TransportFamily | null;
  readonly reason: string;
  readonly reconsiderWhen: string;
}

type CandidateVerdictRegistry = {
  readonly [ProductId in CandidateProductId]: CandidateProductVerdict<ProductId>;
};

export const CANDIDATE_VERDICTS = {
  "xiaomi-mimo": {
    id: "xiaomi-mimo",
    name: "Xiaomi MiMo PAYG",
    verdict: "experimental",
    runnable: false,
    visibleInSetup: false,
    transportFamily: "hosted-api",
    reason: "Ordinary international account access, funding, and review reliability are unproven.",
    reconsiderWhen:
      "A funded eligible account passes exact schema, usage, latency, and moderation proof.",
  },
  "byteplus-modelark": {
    id: "byteplus-modelark",
    name: "BytePlus ModelArk",
    verdict: "experimental",
    runnable: false,
    visibleInSetup: false,
    transportFamily: "hosted-api",
    reason:
      "Tenant-specific model activation, regional availability, and strict output remain unproven.",
    reconsiderWhen:
      "An eligible tenant passes exact regional model, schema, price, and limit proof.",
  },
  "cloudflare-workers-ai": {
    id: "cloudflare-workers-ai",
    name: "Cloudflare Workers AI",
    verdict: "experimental",
    runnable: false,
    visibleInSetup: false,
    transportFamily: "hosted-api",
    reason: "Account-scoped setup and reliable JSON Schema conformance need separate proof.",
    reconsiderWhen:
      "A narrow model allowlist passes repeated schema and account-bound privacy proof.",
  },
  vllm: {
    id: "vllm",
    name: "vLLM",
    verdict: "experimental",
    runnable: false,
    visibleInSetup: false,
    transportFamily: "local-http",
    reason:
      "Structured output depends on runtime configuration and remote deployments exceed local scope.",
    reconsiderWhen:
      "A separately scoped loopback profile passes version-bound schema and abort proof.",
  },
  "minimax-token-plan": {
    id: "minimax-token-plan",
    name: "MiniMax Token Plan",
    verdict: "experimental",
    runnable: false,
    visibleInSetup: false,
    transportFamily: "hosted-api",
    reason: "The individual plan is throttled and lacks an established review schema contract.",
    reconsiderWhen:
      "A user-triggered plan scope proves authorization, privacy, schema output, and bounds.",
  },
  "kimi-code-cli": {
    id: "kimi-code-cli",
    name: "Kimi Code CLI",
    verdict: "experimental",
    runnable: false,
    visibleInSetup: false,
    transportFamily: "local-cli",
    reason: "Prompt mode may approve tool calls and lacks a proven side-effect-free profile.",
    reconsiderWhen:
      "A pinned release passes deny, isolation, schema, account, and cancellation proof.",
  },
  "kiro-cli": {
    id: "kiro-cli",
    name: "Kiro CLI",
    verdict: "experimental",
    runnable: false,
    visibleInSetup: false,
    transportFamily: "local-cli",
    reason: "Authorization and a pinned no-tools, no-MCP review profile remain unproven.",
    reconsiderWhen:
      "AWS confirms this integration and a pinned profile passes all negative proofs.",
  },
  "cursor-agent-cli": {
    id: "cursor-agent-cli",
    name: "Cursor Agent CLI",
    verdict: "experimental",
    runnable: false,
    visibleInSetup: false,
    transportFamily: "local-cli",
    reason: "The beta agent-first CLI lacks a proven side-effect-free review profile.",
    reconsiderWhen:
      "A pinned release passes auth, deny, isolation, privacy, schema, and cancellation proof.",
  },
  "minimax-payg": {
    id: "minimax-payg",
    name: "MiniMax PAYG",
    verdict: "deferred",
    runnable: false,
    visibleInSetup: false,
    transportFamily: "hosted-api",
    reason: "Current review-oriented models lack a documented structured-output contract.",
    reconsiderWhen:
      "An exact model documents and passes structured output plus terminal usage proof.",
  },
  "tencent-hunyuan-tokenhub": {
    id: "tencent-hunyuan-tokenhub",
    name: "Tencent Hunyuan / TokenHub",
    verdict: "deferred",
    runnable: false,
    visibleInSetup: false,
    transportFamily: "hosted-api",
    reason: "The migration leaves model, price, region, output, and data terms unstable.",
    reconsiderWhen: "TokenHub publishes a stable purchasable contract and passes end-to-end proof.",
  },
  "opencode-cli": {
    id: "opencode-cli",
    name: "OpenCode CLI",
    verdict: "deferred",
    runnable: false,
    visibleInSetup: false,
    transportFamily: "local-cli",
    reason:
      "Permissive defaults, event volatility, and subscription authorization remain unresolved.",
    reconsiderWhen:
      "A pinned authorized profile passes deny, isolation, schema, and cancellation proof.",
  },
  "hugging-face-inference-providers": {
    id: "hugging-face-inference-providers",
    name: "Hugging Face Inference Providers",
    verdict: "deferred",
    runnable: false,
    visibleInSetup: false,
    transportFamily: "hosted-api",
    reason:
      "Downstream route, privacy, region, license, and schema properties are provider-specific.",
    reconsiderWhen:
      "One pinned downstream route can be persisted, disclosed, and conformance-proven.",
  },
  "together-ai": {
    id: "together-ai",
    name: "Together AI",
    verdict: "deferred",
    runnable: false,
    visibleInSetup: false,
    transportFamily: "hosted-api",
    reason: "No distinct cost, capability, or privacy benefit over the selected tranche is proven.",
    reconsiderWhen:
      "A distinct exact product advantage and full conformance proof are established.",
  },
  "fireworks-ai": {
    id: "fireworks-ai",
    name: "Fireworks AI",
    verdict: "deferred",
    runnable: false,
    visibleInSetup: false,
    transportFamily: "hosted-api",
    reason: "No distinct model, availability, cost, or privacy advantage is proven.",
    reconsiderWhen:
      "A distinct exact product advantage and full conformance proof are established.",
  },
  "remote-custom-url": {
    id: "remote-custom-url",
    name: "Arbitrary remote custom URL",
    verdict: "deferred",
    runnable: false,
    visibleInSetup: false,
    transportFamily: "hosted-api",
    reason: "A general remote connector would create an unbounded proxy and SSRF surface.",
    reconsiderWhen: "A separately scoped trust and endpoint policy is approved and proven.",
  },
  "compatible-api-vendor-sdk": {
    id: "compatible-api-vendor-sdk",
    name: "Per-vendor compatible API SDK",
    verdict: "deferred",
    runnable: false,
    visibleInSetup: false,
    transportFamily: "hosted-api",
    reason: "Ordinary compatible APIs do not justify additional vendor runtime dependencies.",
    reconsiderWhen: "A safely typed protocol incompatibility is demonstrated.",
  },
  "kimi-code-http": {
    id: "kimi-code-http",
    name: "Kimi Code direct HTTP",
    verdict: "rejected",
    runnable: false,
    visibleInSetup: false,
    transportFamily: "hosted-api",
    reason: "Plan benefits are limited to supported tools and do not authorize this client.",
    reconsiderWhen: "Written authorization covers this exact direct integration.",
  },
  "alibaba-coding-plan": {
    id: "alibaba-coding-plan",
    name: "Alibaba Coding / Token Plan",
    verdict: "rejected",
    runnable: false,
    visibleInSetup: false,
    transportFamily: "hosted-api",
    reason: "Plan endpoints are restricted to supported coding tools, not backend services.",
    reconsiderWhen: "Written authorization covers this exact backend integration.",
  },
  "byteplus-coding-plan": {
    id: "byteplus-coding-plan",
    name: "BytePlus Coding / Token Plan",
    verdict: "rejected",
    runnable: false,
    visibleInSetup: false,
    transportFamily: "hosted-api",
    reason:
      "Plan endpoints are restricted to supported coding tools and unauthorized use risks suspension.",
    reconsiderWhen: "Written authorization covers this exact backend integration.",
  },
  "volcengine-ark": {
    id: "volcengine-ark",
    name: "Volcengine Ark",
    verdict: "rejected",
    runnable: false,
    visibleInSetup: false,
    transportFamily: "hosted-api",
    reason:
      "No official global account, billing, regional-processing, and availability contract exists.",
    reconsiderWhen: "A suitable official non-China product contract is published and proven.",
  },
  "gemini-cli": {
    id: "gemini-cli",
    name: "Gemini CLI OAuth / subscription",
    verdict: "rejected",
    runnable: false,
    visibleInSetup: false,
    transportFamily: "local-cli",
    reason:
      "Google prohibits third-party use of Gemini CLI OAuth and the individual service ended.",
    reconsiderWhen: "A separately approved BYOK API product is evaluated.",
  },
  "claude-code": {
    id: "claude-code",
    name: "Claude Code subscription",
    verdict: "rejected",
    runnable: false,
    visibleInSetup: false,
    transportFamily: "local-cli",
    reason:
      "Anthropic forbids unapproved third parties from offering Claude subscription login or limits.",
    reconsiderWhen: "Anthropic provides written authorization for this exact integration.",
  },
  "github-models": {
    id: "github-models",
    name: "GitHub Models",
    verdict: "rejected",
    runnable: false,
    visibleInSetup: false,
    transportFamily: "hosted-api",
    reason: "The inference API and related service are retired and return HTTP 410.",
    reconsiderWhen: "A new official service receives a separate product decision.",
  },
  "nvidia-api-catalog": {
    id: "nvidia-api-catalog",
    name: "NVIDIA hosted API Catalog/build API",
    verdict: "rejected",
    runnable: false,
    visibleInSetup: false,
    transportFamily: "hosted-api",
    reason: "Evaluation terms do not permit the repository-input and product use required here.",
    reconsiderWhen: "A suitable commercial contract and exact provider proof are established.",
  },
  "sdk-product-registry": {
    id: "sdk-product-registry",
    name: "AI SDK registry as product authority",
    verdict: "rejected",
    runnable: false,
    visibleInSetup: false,
    transportFamily: null,
    reason:
      "An SDK registry does not own Diffgazer product, readiness, notice, or persistence policy.",
    reconsiderWhen: "Never; SDK compatibility remains observation data, not product eligibility.",
  },
} as const satisfies CandidateVerdictRegistry;
