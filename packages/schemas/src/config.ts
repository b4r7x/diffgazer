import { z } from "zod";
import { SHARED_ERROR_CODES, type SharedErrorCode } from "./errors.js";

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

const _geminiModelInfo = {
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
} as const satisfies Record<GeminiModel, ModelInfo>;

// Validate GEMINI_MODEL_INFO at module load time
export const GEMINI_MODEL_INFO: Record<GeminiModel, ModelInfo> = Object.fromEntries(
  Object.entries(_geminiModelInfo).map(([key, value]) => [key, ModelInfoSchema.parse(value)])
) as Record<GeminiModel, ModelInfo>;

export const ProviderInfoSchema = z.object({
  id: AIProviderSchema,
  name: z.string(),
  defaultModel: z.string(),
  models: z.array(z.string()).readonly(),
});
export type ProviderInfo = z.infer<typeof ProviderInfoSchema>;

const _availableProviders = [
  {
    id: "gemini",
    name: "Google Gemini",
    defaultModel: "gemini-2.5-flash",
    models: GEMINI_MODELS,
  },
] as const satisfies readonly ProviderInfo[];

// Validate AVAILABLE_PROVIDERS at module load time
export const AVAILABLE_PROVIDERS: ProviderInfo[] = _availableProviders.map((provider) =>
  ProviderInfoSchema.parse(provider)
);

export const UserConfigSchema = z.object({
  provider: AIProviderSchema,
  model: z.string().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
}).refine((data) => {
  if (!data.model) return true; // No model specified is OK

  if (data.provider === "gemini") {
    return GEMINI_MODELS.includes(data.model as GeminiModel);
  }

  // Add other providers here as they're added
  return true;
}, {
  message: "Model is not valid for the selected provider",
  path: ["model"],
});
export type UserConfig = z.infer<typeof UserConfigSchema>;

/** Config-specific error codes (domain-specific) */
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

/** All config error codes: shared + domain-specific */
export const CONFIG_ERROR_CODES = [...SHARED_ERROR_CODES, ...CONFIG_SPECIFIC_CODES] as const;
export const ConfigErrorCodeSchema = z.enum(CONFIG_ERROR_CODES);
export type ConfigErrorCode = SharedErrorCode | ConfigSpecificCode;

export const ConfigErrorSchema = z.object({
  message: z.string(),
  code: ConfigErrorCodeSchema,
});
export type ConfigError = z.infer<typeof ConfigErrorSchema>;

export const SaveConfigRequestSchema = z.object({
  provider: AIProviderSchema,
  apiKey: z.string().min(1),
  model: z.string().optional(),
});
export type SaveConfigRequest = z.infer<typeof SaveConfigRequestSchema>;

const ConfiguredSchema = z.object({
  configured: z.literal(true),
  config: z.object({
    provider: AIProviderSchema,
    model: z.string().optional(),
  }),
});

const UnconfiguredSchema = z.object({
  configured: z.literal(false),
});

export const ConfigCheckResponseSchema = z.discriminatedUnion("configured", [
  ConfiguredSchema,
  UnconfiguredSchema,
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
