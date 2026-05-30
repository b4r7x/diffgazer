import { z } from "zod";

export const GEMINI_MODELS = [
  "gemini-3-flash-preview",
  "gemini-3-pro-preview",
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
  "gemini-2.5-pro",
] as const;

const GeminiModelSchema = z.enum(GEMINI_MODELS);
type GeminiModel = z.infer<typeof GeminiModelSchema>;

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
    name: "Gemini 3 Flash (Preview)",
    description: "Preview Gemini 3 Flash model for lower-latency multimodal generation.",
    tier: "paid",
  },
  "gemini-3-pro-preview": {
    id: "gemini-3-pro-preview",
    name: "Gemini 3 Pro (Preview)",
    description: "Preview Gemini 3 Pro model for complex reasoning and analysis.",
    tier: "paid",
  },
  "gemini-2.5-flash": {
    id: "gemini-2.5-flash",
    name: "Gemini 2.5 Flash (Stable)",
    description: "Stable Gemini 2.5 Flash model with up to 1M-token context window.",
    tier: "free",
    recommended: true,
  },
  "gemini-2.5-flash-lite": {
    id: "gemini-2.5-flash-lite",
    name: "Gemini 2.5 Flash-Lite (Stable)",
    description: "Stable low-cost Gemini 2.5 variant for high-throughput workloads.",
    tier: "free",
  },
  "gemini-2.5-pro": {
    id: "gemini-2.5-pro",
    name: "Gemini 2.5 Pro (Stable)",
    description: "Stable Gemini 2.5 Pro model for higher-reasoning workloads.",
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
    description: "General-purpose GLM-4.7 model on the standard Z.AI endpoint.",
    tier: "paid",
    recommended: true,
  },
  "glm-4.7-flashx": {
    id: "glm-4.7-flashx",
    name: "GLM-4.7 FlashX",
    description: "Lower-cost GLM-4.7 variant; promotional free period ended on 2026-01-30.",
    tier: "paid",
  },
  "glm-4.7-flash": {
    id: "glm-4.7-flash",
    name: "GLM-4.7 Flash",
    description: "Fast GLM-4.7 variant; promotional free period ended 2026-03-31.",
    tier: "paid",
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
  keyHash: z.string().optional(),
});

export type OpenRouterModelCache = z.infer<typeof OpenRouterModelCacheSchema>;

export const OpenRouterModelsResponseSchema = z.object({
  models: z.array(OpenRouterModelSchema),
  fetchedAt: z.string().datetime(),
  cached: z.boolean(),
});

export type OpenRouterModelsResponse = z.infer<typeof OpenRouterModelsResponseSchema>;
