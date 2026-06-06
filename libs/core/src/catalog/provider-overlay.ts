import type { AIProvider } from "../schemas/config/index.js";

/** Which PRICED models a provider's free quota covers. `'all'` = whole provider. */
type FreeTierSelector = "all" | { ids?: string[]; families?: string[] };

export type ProviderOverlay = {
  /** models.dev provider id(s) merged into this Diffgazer provider. */
  modelsDevIds: string[];
  /** Diffgazer's credential env var — NEVER models.dev's (e.g. ZHIPU_API_KEY). */
  diffgazerEnvVar: string;
  /**
   * Optional curated OVERRIDE for the human display name. The PRIMARY source is
   * the models.dev provider `name`; this only overrides it (today: gemini ->
   * "Google Gemini"). Omit to derive from models.dev (then humanize(id)).
   */
  displayName?: string;
  /** Provider-level free-tier badge + free/paid provider filter. */
  hasFreeTier: boolean;
  /** Curated: which priced models the free quota covers. Omit => only zero-cost models are free. */
  freeTier?: FreeTierSelector;
  /** Honest UI prose for the free tier (e.g. daily token cap). */
  freeTierNote?: string;
  defaultModel: string;
  recommendedModelId?: string;
  sdkKind: "google" | "openrouter" | "zhipu" | "openai-compatible";
  /** Required for zhipu + openai-compatible SDK factories. */
  baseURL?: string;
  /** Gates picker selection + createLanguageModel wiring. */
  enabled: boolean;
};

export const PROVIDER_OVERLAY: Record<AIProvider, ProviderOverlay> = {
  gemini: {
    modelsDevIds: ["google"],
    diffgazerEnvVar: "GOOGLE_API_KEY",
    // Curated override: pins the existing "Google Gemini" copy (filter / keyboard /
    // capabilities tests). All other providers derive their name from models.dev.
    displayName: "Google Gemini",
    hasFreeTier: true,
    freeTier: { ids: ["gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-2.5-pro"] },
    defaultModel: "gemini-2.5-flash",
    recommendedModelId: "gemini-2.5-flash",
    sdkKind: "google",
    enabled: true,
  },
  zai: {
    modelsDevIds: ["zai"],
    diffgazerEnvVar: "ZAI_API_KEY",
    hasFreeTier: true,
    defaultModel: "glm-4.7",
    recommendedModelId: "glm-4.7",
    sdkKind: "zhipu",
    baseURL: "https://api.z.ai/api/paas/v4",
    enabled: true,
  },
  "zai-coding": {
    modelsDevIds: ["zai-coding-plan"],
    diffgazerEnvVar: "ZAI_API_KEY",
    hasFreeTier: false,
    defaultModel: "glm-4.7",
    recommendedModelId: "glm-4.7",
    sdkKind: "zhipu",
    baseURL: "https://api.z.ai/api/coding/paas/v4",
    enabled: true,
  },
  openrouter: {
    modelsDevIds: ["openrouter"],
    diffgazerEnvVar: "OPENROUTER_API_KEY",
    hasFreeTier: true,
    defaultModel: "",
    sdkKind: "openrouter",
    enabled: true,
  },
  groq: {
    modelsDevIds: ["groq"],
    diffgazerEnvVar: "GROQ_API_KEY",
    hasFreeTier: true,
    freeTier: "all",
    defaultModel: "meta-llama/llama-4-scout-17b-16e-instruct",
    recommendedModelId: "meta-llama/llama-4-scout-17b-16e-instruct",
    sdkKind: "openai-compatible",
    baseURL: "https://api.groq.com/openai/v1",
    enabled: true,
  },
  cerebras: {
    modelsDevIds: ["cerebras"],
    diffgazerEnvVar: "CEREBRAS_API_KEY",
    hasFreeTier: true,
    freeTier: "all",
    freeTierNote: "Cerebras free tier: ~1M tokens/day.",
    defaultModel: "gpt-oss-120b",
    recommendedModelId: "gpt-oss-120b",
    sdkKind: "openai-compatible",
    baseURL: "https://api.cerebras.ai/v1",
    enabled: true,
  },
};

/**
 * Catalog-data-only providers. These are NOT AIProvider enum members (the enum
 * stays closed; only enabled, wired providers are members), so they live outside
 * the exhaustive PROVIDER_OVERLAY record. They are catalog data, NOT shown in any
 * picker until a documented UI boundary exists.
 */
export const SURFACED_OVERLAYS: Record<string, ProviderOverlay> = {
  mistral: {
    modelsDevIds: ["mistral"],
    diffgazerEnvVar: "MISTRAL_API_KEY",
    hasFreeTier: true,
    defaultModel: "",
    sdkKind: "openai-compatible",
    enabled: false,
  },
  huggingface: {
    modelsDevIds: ["huggingface"],
    diffgazerEnvVar: "HF_TOKEN",
    hasFreeTier: true,
    defaultModel: "",
    sdkKind: "openai-compatible",
    baseURL: "https://router.huggingface.co/v1",
    enabled: false,
  },
  "github-models": {
    modelsDevIds: ["github-models"],
    diffgazerEnvVar: "GITHUB_TOKEN",
    hasFreeTier: true,
    defaultModel: "",
    sdkKind: "openai-compatible",
    baseURL: "https://models.github.ai/inference",
    enabled: false,
  },
};
