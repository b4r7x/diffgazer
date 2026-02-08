import type { AIProvider } from "@stargazer/schemas/config";

export const DEFAULT_TTL = 5 * 60 * 1000;

export const OPENROUTER_PROVIDER_ID: AIProvider = "openrouter";

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
    costDescription: 'Model-based pricing. Official notices list GLM-4.7-Flash free through 2026-03-31 and GLM-4.7-FlashX free period ended on 2026-01-30.',
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
