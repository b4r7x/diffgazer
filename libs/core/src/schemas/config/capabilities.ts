import type { AIProvider, ProviderInfo } from "./providers";
import { GEMINI_MODELS, GLM_MODELS } from "./models";

export const OPENROUTER_PROVIDER_ID: AIProvider = "openrouter";

export const AVAILABLE_PROVIDERS: ProviderInfo[] = [
  {
    id: "gemini",
    name: "Google Gemini",
    defaultModel: "gemini-2.5-flash",
    models: [...GEMINI_MODELS],
  },
  {
    id: "zai",
    name: "Z.AI",
    defaultModel: "glm-4.7",
    models: [...GLM_MODELS],
  },
  {
    id: "zai-coding",
    name: "Z.AI Coding Plan",
    defaultModel: "glm-4.7",
    models: [...GLM_MODELS],
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    defaultModel: "",
    models: [],
  },
];

export const PROVIDER_CAPABILITIES: Record<AIProvider, {
  toolCalling: string;
  jsonMode: string;
  streaming: string;
  contextWindow: string;
  tier: 'free' | 'paid' | 'mixed';
  tierBadge: 'FREE' | 'PAID';
  capabilities: string[];
  costDescription: string;
}> = {
  gemini: {
    toolCalling: 'Supported (Gemini function calling)',
    jsonMode: 'Supported (structured output / JSON schema)',
    streaming: 'Supported (generateContentStream / SDK streams)',
    contextWindow: 'Model-dependent (default gemini-2.5-flash supports up to 1M tokens)',
    tier: 'mixed',
    tierBadge: 'FREE',
    capabilities: ['TOOLS', 'JSON', 'FAST'],
    costDescription: 'Gemini 2.5 models have free and paid tiers; pricing and limits depend on model/version and account usage tier.',
  },
  zai: {
    toolCalling: 'Supported (Chat Completions tools)',
    jsonMode: 'Supported (json_object / json_schema)',
    streaming: 'Supported (Chat Completions stream=true)',
    contextWindow: 'Up to 200K tokens (GLM-4.7 series)',
    tier: 'mixed',
    tierBadge: 'FREE',
    capabilities: ['FAST', 'TOOLS'],
    costDescription: 'Model-based pricing. Free and paid tiers vary by model and current Z.AI plan terms.',
  },
  "zai-coding": {
    toolCalling: 'Supported (Chat Completions tools)',
    jsonMode: 'Supported (json_object / json_schema)',
    streaming: 'Supported (Chat Completions stream=true)',
    contextWindow: 'Up to 200K tokens (GLM-4.7 series)',
    tier: 'paid',
    tierBadge: 'PAID',
    capabilities: ['FAST', 'TOOLS'],
    costDescription: 'Uses the Z.AI coding endpoint. Pricing and limits depend on selected model and current Z.AI plan terms.',
  },
  openrouter: {
    toolCalling: 'Varies by model',
    jsonMode: 'Varies by model',
    streaming: 'Supported (model-dependent)',
    contextWindow: 'Varies by model',
    tier: 'mixed',
    tierBadge: 'PAID',
    capabilities: ['MULTI-PROVIDER'],
    costDescription: 'Unified API across providers. Model availability, capabilities, and pricing are model-specific.',
  },
};

export const PROVIDER_ENV_VARS: Record<AIProvider, string> = {
  gemini: 'GOOGLE_API_KEY',
  zai: 'ZAI_API_KEY',
  'zai-coding': 'ZAI_API_KEY',
  openrouter: 'OPENROUTER_API_KEY',
};

/** The set of env var names that are valid for `CredentialRef` with `kind: "env"`. */
export const ALLOWED_CREDENTIAL_ENV_VARS: ReadonlySet<string> = new Set(
  Object.values(PROVIDER_ENV_VARS),
);
