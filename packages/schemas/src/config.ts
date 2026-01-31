import { z } from "zod";
import {
  createDomainErrorCodes,
  createDomainErrorSchema,
  timestampFields,
  type SharedErrorCode,
} from "./errors.js";
import { SettingsConfigSchema } from "./settings.js";

export const AI_PROVIDERS = ["gemini", "openai", "anthropic", "glm", "openrouter"] as const;
export const AIProviderSchema = z.enum(AI_PROVIDERS);
export type AIProvider = z.infer<typeof AIProviderSchema>;

export const GEMINI_MODELS = [
  "gemini-3-flash-preview",
  "gemini-3-pro-preview",
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
  "gemini-2.5-pro",
] as const;

export const GeminiModelSchema = z.enum(GEMINI_MODELS);
export type GeminiModel = z.infer<typeof GeminiModelSchema>;

export const ModelInfoSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  tier: z.enum(["free", "paid"]),
  recommended: z.boolean().optional(),
});
export type ModelInfo = z.infer<typeof ModelInfoSchema>;

export const GEMINI_MODEL_INFO: Record<GeminiModel, ModelInfo> = {
  "gemini-3-flash-preview": {
    id: "gemini-3-flash-preview",
    name: "Gemini 3 Flash",
    description: "Latest preview, balanced speed and intelligence",
    tier: "paid",
  },
  "gemini-3-pro-preview": {
    id: "gemini-3-pro-preview",
    name: "Gemini 3 Pro",
    description: "Most intelligent, reasoning-first model",
    tier: "paid",
  },
  "gemini-2.5-flash": {
    id: "gemini-2.5-flash",
    name: "Gemini 2.5 Flash",
    description: "Best balance of speed and quality",
    tier: "free",
    recommended: true,
  },
  "gemini-2.5-flash-lite": {
    id: "gemini-2.5-flash-lite",
    name: "Gemini 2.5 Flash Lite",
    description: "Fastest and cheapest, highest free limits",
    tier: "free",
  },
  "gemini-2.5-pro": {
    id: "gemini-2.5-pro",
    name: "Gemini 2.5 Pro",
    description: "Best quality for complex analysis",
    tier: "free",
  },
};

export const OPENAI_MODELS = [
  "gpt-4o",
  "gpt-4o-mini",
  "gpt-4-turbo",
  "o1-preview",
  "o1-mini",
] as const;

export const OpenAIModelSchema = z.enum(OPENAI_MODELS);
export type OpenAIModel = z.infer<typeof OpenAIModelSchema>;

export const OPENAI_MODEL_INFO: Record<OpenAIModel, ModelInfo> = {
  "gpt-4o": {
    id: "gpt-4o",
    name: "GPT-4o",
    description: "Most capable multimodal model",
    tier: "paid",
    recommended: true,
  },
  "gpt-4o-mini": {
    id: "gpt-4o-mini",
    name: "GPT-4o Mini",
    description: "Fast and affordable for lighter tasks",
    tier: "paid",
  },
  "gpt-4-turbo": {
    id: "gpt-4-turbo",
    name: "GPT-4 Turbo",
    description: "High intelligence with vision capabilities",
    tier: "paid",
  },
  "o1-preview": {
    id: "o1-preview",
    name: "o1 Preview",
    description: "Advanced reasoning model",
    tier: "paid",
  },
  "o1-mini": {
    id: "o1-mini",
    name: "o1 Mini",
    description: "Fast reasoning model",
    tier: "paid",
  },
};

export const ANTHROPIC_MODELS = [
  "claude-sonnet-4-20250514",
  "claude-3-5-sonnet-20241022",
  "claude-3-5-haiku-20241022",
  "claude-3-opus-20240229",
] as const;

export const AnthropicModelSchema = z.enum(ANTHROPIC_MODELS);
export type AnthropicModel = z.infer<typeof AnthropicModelSchema>;

export const ANTHROPIC_MODEL_INFO: Record<AnthropicModel, ModelInfo> = {
  "claude-sonnet-4-20250514": {
    id: "claude-sonnet-4-20250514",
    name: "Claude Sonnet 4",
    description: "Latest Sonnet with improved reasoning",
    tier: "paid",
    recommended: true,
  },
  "claude-3-5-sonnet-20241022": {
    id: "claude-3-5-sonnet-20241022",
    name: "Claude 3.5 Sonnet",
    description: "Excellent balance of intelligence and speed",
    tier: "paid",
  },
  "claude-3-5-haiku-20241022": {
    id: "claude-3-5-haiku-20241022",
    name: "Claude 3.5 Haiku",
    description: "Fast and efficient for simple tasks",
    tier: "paid",
  },
  "claude-3-opus-20240229": {
    id: "claude-3-opus-20240229",
    name: "Claude 3 Opus",
    description: "Most powerful for complex analysis",
    tier: "paid",
  },
};

export const GLM_MODELS = ["glm-4.7", "glm-4.6"] as const;
export type GLMModel = (typeof GLM_MODELS)[number];

export const GLM_MODEL_INFO: Record<GLMModel, ModelInfo> = {
  "glm-4.7": {
    id: "glm-4.7",
    name: "GLM-4.7",
    description: "Latest GLM with 200K context, excellent for coding",
    tier: "paid",
    recommended: true,
  },
  "glm-4.6": {
    id: "glm-4.6",
    name: "GLM-4.6",
    description: "Previous generation GLM model",
    tier: "paid",
    recommended: false,
  },
};

export const GLM_ENDPOINTS = ["coding", "standard"] as const;
export type GLMEndpoint = (typeof GLM_ENDPOINTS)[number];

export const OpenRouterModelSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  contextLength: z.number(),
  pricing: z.object({
    prompt: z.string(),
    completion: z.string(),
  }),
  isFree: z.boolean(),
});

export type OpenRouterModel = z.infer<typeof OpenRouterModelSchema>;

export const OpenRouterModelCacheSchema = z.object({
  models: z.array(OpenRouterModelSchema),
  fetchedAt: z.string().datetime(),
});

export type OpenRouterModelCache = z.infer<typeof OpenRouterModelCacheSchema>;

export const ProviderInfoSchema = z.object({
  id: AIProviderSchema,
  name: z.string(),
  defaultModel: z.string(),
  models: z.array(z.string()).readonly(),
});
export type ProviderInfo = z.infer<typeof ProviderInfoSchema>;

export const AVAILABLE_PROVIDERS: ProviderInfo[] = [
  {
    id: "gemini",
    name: "Google Gemini",
    defaultModel: "gemini-2.5-flash",
    models: [...GEMINI_MODELS],
  },
  {
    id: "openai",
    name: "OpenAI",
    defaultModel: "gpt-4o",
    models: [...OPENAI_MODELS],
  },
  {
    id: "anthropic",
    name: "Anthropic",
    defaultModel: "claude-sonnet-4-20250514",
    models: [...ANTHROPIC_MODELS],
  },
  {
    id: "glm",
    name: "GLM (Z.ai)",
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

function isValidModelForProvider(provider: AIProvider, model: string): boolean {
  switch (provider) {
    case "gemini":
      return GEMINI_MODELS.includes(model as GeminiModel);
    case "openai":
      return OPENAI_MODELS.includes(model as OpenAIModel);
    case "anthropic":
      return ANTHROPIC_MODELS.includes(model as AnthropicModel);
    case "glm":
      return GLM_MODELS.includes(model as GLMModel);
    case "openrouter":
      return true; // Dynamic models, validated elsewhere
    default:
      return true;
  }
}

export const UserConfigSchema = z
  .object({
    provider: AIProviderSchema,
    model: z.string().optional(),
    glmEndpoint: z.enum(GLM_ENDPOINTS).optional(),
    ...timestampFields,
  })
  .refine((data) => !data.model || isValidModelForProvider(data.provider, data.model), {
    message: "Model is not valid for the selected provider",
    path: ["model"],
  });
export type UserConfig = z.infer<typeof UserConfigSchema>;

export const CONFIG_SPECIFIC_CODES = [
  "NOT_CONFIGURED",
  "INVALID_PROVIDER",
  "INVALID_API_KEY",
  "CONFIG_NOT_FOUND",
  "CONFIG_WRITE_FAILED",
  "CONFIG_READ_FAILED",
  "UNKNOWN",
] as const;
export type ConfigSpecificCode = (typeof CONFIG_SPECIFIC_CODES)[number];

export const CONFIG_ERROR_CODES = createDomainErrorCodes(CONFIG_SPECIFIC_CODES);
export const ConfigErrorCodeSchema = z.enum(CONFIG_ERROR_CODES as unknown as [string, ...string[]]);
export type ConfigErrorCode = SharedErrorCode | ConfigSpecificCode;

export const ConfigErrorSchema = createDomainErrorSchema(CONFIG_SPECIFIC_CODES);
export type ConfigError = z.infer<typeof ConfigErrorSchema>;

export const SaveConfigRequestSchema = z.object({
  provider: AIProviderSchema,
  apiKey: z.string().min(1),
  model: z.string().optional(),
  glmEndpoint: z.enum(GLM_ENDPOINTS).optional(),
});
export type SaveConfigRequest = z.infer<typeof SaveConfigRequestSchema>;

export const ConfigCheckResponseSchema = z.discriminatedUnion("configured", [
  z.object({
    configured: z.literal(true),
    config: z.object({
      provider: AIProviderSchema,
      model: z.string().optional(),
    }),
  }),
  z.object({ configured: z.literal(false) }),
]);
export type ConfigCheckResponse = z.infer<typeof ConfigCheckResponseSchema>;

export const CurrentConfigResponseSchema = z.object({
  provider: AIProviderSchema,
  model: z.string().optional(),
});
export type CurrentConfigResponse = z.infer<typeof CurrentConfigResponseSchema>;

export const DeleteConfigResponseSchema = z.object({
  deleted: z.boolean(),
  warning: z.string().optional(),
});
export type DeleteConfigResponse = z.infer<typeof DeleteConfigResponseSchema>;

export const DeleteProviderCredentialsResponseSchema = z.object({
  deleted: z.boolean(),
  provider: AIProviderSchema,
});
export type DeleteProviderCredentialsResponse = z.infer<typeof DeleteProviderCredentialsResponseSchema>;

export const ProviderStatusSchema = z.object({
  provider: AIProviderSchema,
  hasApiKey: z.boolean(),
  model: z.string().optional(),
  isActive: z.boolean(),
});
export type ProviderStatus = z.infer<typeof ProviderStatusSchema>;

export const ProvidersStatusResponseSchema = z.object({
  providers: z.array(ProviderStatusSchema),
  activeProvider: AIProviderSchema.optional(),
});
export type ProvidersStatusResponse = z.infer<typeof ProvidersStatusResponseSchema>;

export const PROVIDER_ENV_VARS: Record<AIProvider, string> = {
  gemini: 'GOOGLE_API_KEY',
  openai: 'OPENAI_API_KEY',
  anthropic: 'ANTHROPIC_API_KEY',
  glm: 'GLM_API_KEY',
  openrouter: 'OPENROUTER_API_KEY',
};

export const InitResponseSchema = z.object({
  config: z.object({
    provider: AIProviderSchema,
    model: z.string().optional(),
  }).nullable(),
  settings: SettingsConfigSchema,
  providers: z.array(ProviderStatusSchema),
  configured: z.boolean(),
});
export type InitResponse = z.infer<typeof InitResponseSchema>;

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
  openai: {
    toolCalling: 'Supported (Native)',
    jsonMode: 'Supported (JSON mode)',
    streaming: 'Server-Sent Events',
    contextWindow: '128K Tokens',
    tier: 'paid',
    tierBadge: 'PAID',
    capabilities: ['TOOLS', 'JSON', 'VISION'],
    costDescription: 'Pay-per-token pricing. GPT-4o offers best value for code review tasks.',
  },
  anthropic: {
    toolCalling: 'Supported (Native)',
    jsonMode: 'Supported (JSON mode)',
    streaming: 'Server-Sent Events',
    contextWindow: '200K Tokens',
    tier: 'paid',
    tierBadge: 'PAID',
    capabilities: ['TOOLS', 'VISION', 'LONG-CTX'],
    costDescription: 'Pay-per-token pricing. Claude excels at nuanced code analysis.',
  },
  glm: {
    toolCalling: 'Supported (Native)',
    jsonMode: 'Supported',
    streaming: 'Server-Sent Events',
    contextWindow: '200K Tokens',
    tier: 'paid',
    tierBadge: 'PAID',
    capabilities: ['FAST', 'TOOLS'],
    costDescription: 'Competitive pricing for GLM-4.7 with excellent code understanding.',
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
