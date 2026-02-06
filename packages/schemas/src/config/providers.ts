import { z } from "zod";
import {
  createDomainErrorCodes,
  createDomainErrorSchema,
  timestampFields,
  type SharedErrorCode,
} from "../errors.js";
import { SettingsConfigSchema, TrustConfigSchema } from "./settings.js";

export const AI_PROVIDERS = ["gemini", "zai", "zai-coding", "openrouter"] as const;
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

const ModelInfoSchema = z.object({
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

export const GLM_MODELS = ["glm-4.7", "glm-4.7-flashx", "glm-4.7-flash"] as const;
const GLMModelSchema = z.enum(GLM_MODELS);
type GLMModel = z.infer<typeof GLMModelSchema>;

export const GLM_MODEL_INFO: Record<GLMModel, ModelInfo> = {
  "glm-4.7": {
    id: "glm-4.7",
    name: "GLM-4.7",
    description: "Flagship model, highest performance for coding & reasoning",
    tier: "paid",
    recommended: true,
  },
  "glm-4.7-flashx": {
    id: "glm-4.7-flashx",
    name: "GLM-4.7 FlashX",
    description: "Lightweight, high-speed and affordable",
    tier: "paid",
  },
  "glm-4.7-flash": {
    id: "glm-4.7-flash",
    name: "GLM-4.7 Flash",
    description: "Completely free, open-source SOTA performance",
    tier: "free",
  },
};

export const OpenRouterModelSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  contextLength: z.number(),
  supportedParameters: z.array(z.string()).optional(),
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

export const OpenRouterModelsResponseSchema = z.object({
  models: z.array(OpenRouterModelSchema),
  fetchedAt: z.string().datetime(),
  cached: z.boolean(),
});

export type OpenRouterModelsResponse = z.infer<typeof OpenRouterModelsResponseSchema>;

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

function isValidModelForProvider(provider: AIProvider, model: string): boolean {
  switch (provider) {
    case "gemini":
      return GEMINI_MODELS.includes(model as GeminiModel);
    case "zai":
    case "zai-coding":
      return GLM_MODELS.includes(model as GLMModel);
    case "openrouter":
      return true;
    default:
      return false;
  }
}

export const UserConfigSchema = z
  .object({
    provider: AIProviderSchema,
    model: z.string().optional(),
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
type ConfigSpecificCode = (typeof CONFIG_SPECIFIC_CODES)[number];

const CONFIG_ERROR_CODES = createDomainErrorCodes(CONFIG_SPECIFIC_CODES);
const ConfigErrorCodeSchema = z.enum(CONFIG_ERROR_CODES);

const ConfigErrorSchema = createDomainErrorSchema(CONFIG_SPECIFIC_CODES);

export const SaveConfigRequestSchema = z.object({
  provider: AIProviderSchema,
  apiKey: z.string().min(1),
  model: z.string().optional(),
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

export const ProjectInfoSchema = z.object({
  path: z.string(),
  projectId: z.string(),
  trust: TrustConfigSchema.nullable(),
});
export type ProjectInfo = z.infer<typeof ProjectInfoSchema>;

export interface ActivateProviderResponse {
  provider: AIProvider;
  model?: string;
}

export const PROVIDER_ENV_VARS: Record<AIProvider, string> = {
  gemini: 'GOOGLE_API_KEY',
  zai: 'ZAI_API_KEY',
  'zai-coding': 'ZAI_API_KEY',
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
  project: ProjectInfoSchema,
});
export type InitResponse = z.infer<typeof InitResponseSchema>;
