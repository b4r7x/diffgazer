import { z } from "zod";
import { ConfigurationIdSchema } from "./provider-config.js";
import { RunnableProductIdSchema, TransportFamilySchema } from "./transports.js";

/**
 * Billing-neutral model classifications used by discovery payloads.
 *
 * `free` and `paid` are only used when the applicable provider has established
 * that billing classification. Local runtimes and ambient vendor-managed CLI
 * auth deliberately use neutral values: neither value makes a cost or quota
 * promise.
 */
export const ModelTierSchema = z.enum(["free", "paid", "local", "ambient"]);

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

/**
 * Per-configuration catalog discovery wire contract for the model picker.
 * `passed` carries bounded catalog observations (never admission evidence);
 * `skipped` carries a registry-owned reason for products without catalog
 * observations. The `cached`/`source` pair keeps the ProviderModelsResponse
 * invariant: contradictory provenance must fail to parse.
 */
export const ConfigurationModelsResponseSchema = z
  .discriminatedUnion("status", [
    z.strictObject({
      status: z.literal("passed"),
      configurationId: ConfigurationIdSchema,
      productId: RunnableProductIdSchema,
      transportFamily: TransportFamilySchema,
      models: z.array(ModelInfoSchema),
      checkedAt: z.iso.datetime(),
      source: z.enum(["live", "cache", "snapshot"]),
      cached: z.boolean(),
    }),
    z.strictObject({
      status: z.literal("skipped"),
      configurationId: ConfigurationIdSchema,
      productId: RunnableProductIdSchema,
      transportFamily: TransportFamilySchema,
      models: z.array(ModelInfoSchema).max(0),
      checkedAt: z.iso.datetime(),
      reason: z.string().min(1).max(512),
    }),
  ])
  .refine(
    (response) => response.status !== "passed" || response.cached === (response.source === "cache"),
    { path: ["cached"], message: "cached must be true only when source is cache" },
  );

export type ConfigurationModelsResponse = z.infer<typeof ConfigurationModelsResponseSchema>;
