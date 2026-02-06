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
    toolCalling: 'Supported (Native)',
    jsonMode: 'Supported (Schema constraints)',
    streaming: 'Native Server-Sent Events',
    contextWindow: '1M - 2M Tokens',
    tier: 'mixed',
    tierBadge: 'FREE',
    capabilities: ['TOOLS', 'JSON', 'FAST'],
    costDescription: 'Free tier available for Gemini 1.5 Flash and Pro within rate limits. Paid tier offers higher throughput and per-token billing for commercial use.',
  },
  zai: {
    toolCalling: 'Supported (Native)',
    jsonMode: 'Supported',
    streaming: 'Server-Sent Events',
    contextWindow: '200K Tokens',
    tier: 'paid',
    tierBadge: 'PAID',
    capabilities: ['FAST', 'TOOLS'],
    costDescription: 'Z.AI standard endpoint for GLM models.',
  },
  "zai-coding": {
    toolCalling: 'Supported (Native)',
    jsonMode: 'Supported',
    streaming: 'Server-Sent Events',
    contextWindow: '200K Tokens',
    tier: 'paid',
    tierBadge: 'PAID',
    capabilities: ['FAST', 'TOOLS'],
    costDescription: 'Z.AI coding endpoint optimized for code-centric workloads.',
  },
  openrouter: {
    toolCalling: 'Varies by model',
    jsonMode: 'Varies by model',
    streaming: 'Supported',
    contextWindow: 'Varies by model',
    tier: 'mixed',
    tierBadge: 'PAID',
    capabilities: ['MULTI-PROVIDER'],
    costDescription: 'Access multiple providers through single API. Pricing varies by model.',
  },
};
