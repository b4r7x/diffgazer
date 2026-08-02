import { z } from "zod";

/**
 * Billing-neutral model classifications used by discovery payloads.
 *
 * `free` and `paid` are only used when the applicable provider has established
 * that billing classification. Local runtimes and ambient vendor-managed CLI
 * auth deliberately use neutral values: neither value makes a cost or quota
 * promise.
 */
export const ModelTierSchema = z.enum(["free", "paid", "local", "ambient"]);
export type ModelTier = z.infer<typeof ModelTierSchema>;

const ModelInfoSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  tier: ModelTierSchema,
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

/**
 * `cached` is the freshness flag both discovery wire contracts expose (the
 * OpenRouter response has no `source`).  It is not independent state: it is
 * exactly `source === "cache"`, so a contradictory pair must fail to parse
 * rather than reach a consumer that trusts one field over the other.
 */
export const ProviderModelsResponseSchema = z
  .object({
    models: z.array(ModelInfoSchema),
    fetchedAt: z.iso.datetime(),
    source: z.enum(["live", "cache", "snapshot"]),
    cached: z.boolean(),
  })
  .refine((response) => response.cached === (response.source === "cache"), {
    path: ["cached"],
    message: "cached must be true only when source is cache",
  });

export type ProviderModelsResponse = z.infer<typeof ProviderModelsResponseSchema>;
