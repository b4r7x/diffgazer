import { z } from "zod";
import {
  createDomainErrorCodes,
  createDomainErrorSchema,
  timestampFields,
  type SharedErrorCode,
} from "./errors.js";

export const AI_PROVIDERS = ["gemini"] as const;
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
];

function isValidModelForProvider(provider: AIProvider, model: string): boolean {
  if (provider === "gemini") {
    return GEMINI_MODELS.includes(model as GeminiModel);
  }
  return true;
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
});
export type DeleteConfigResponse = z.infer<typeof DeleteConfigResponseSchema>;
