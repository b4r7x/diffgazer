import { z } from "zod";

const ModelInfoSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  tier: z.enum(["free", "paid"]),
  recommended: z.boolean().optional(),
  contextLength: z.number().int().positive().optional(),
  maxOutputTokens: z.number().int().positive().optional(),
});
export type ModelInfo = z.infer<typeof ModelInfoSchema>;

export const OpenRouterModelSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  contextLength: z.number(),
  maxCompletionTokens: z.number().int().positive().optional(),
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
  fetchedAt: z.iso.datetime(),
  keyHash: z.string().optional(),
});

export type OpenRouterModelCache = z.infer<typeof OpenRouterModelCacheSchema>;

export const OpenRouterModelsResponseSchema = z.object({
  models: z.array(OpenRouterModelSchema),
  fetchedAt: z.iso.datetime(),
  cached: z.boolean(),
});

export type OpenRouterModelsResponse = z.infer<typeof OpenRouterModelsResponseSchema>;

export const ProviderModelsResponseSchema = z.object({
  models: z.array(ModelInfoSchema),
  fetchedAt: z.iso.datetime(),
  source: z.enum(["live", "cache", "snapshot"]),
  // `cached` mirrors `source === "cache"`; kept to match the OpenRouter response
  // shape (which has no `source`) so both wire contracts expose one freshness flag.
  cached: z.boolean(),
});

export type ProviderModelsResponse = z.infer<typeof ProviderModelsResponseSchema>;
