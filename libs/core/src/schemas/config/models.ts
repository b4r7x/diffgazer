import { z } from "zod";
import { ConfigurationIdSchema } from "./provider-config.js";
import { RunnableProductIdSchema, TransportFamilySchema } from "./transports.js";

/**
 * Billing-neutral model classifications used by discovery payloads.
 *
 * `free` and `paid` are only used when the applicable provider has established
 * that billing classification. Local runtimes and ambient vendor-managed CLI
 * auth deliberately use neutral values: neither value makes a cost or quota
 * promise. `unknown` covers a catalog model the upstream source publishes no
 * price for — guessing `paid` would be as much of an invented claim as `free`.
 */
export const ModelTierSchema = z.enum(["free", "paid", "unknown", "local", "ambient"]);
export type ModelTier = z.infer<typeof ModelTierSchema>;

const ModelInfoSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  tier: ModelTierSchema,
  recommended: z.boolean().optional(),
});
export type ModelInfo = z.infer<typeof ModelInfoSchema>;

const ProviderModelsBaseSchema = z.object({
  models: z.array(ModelInfoSchema),
  fetchedAt: z.iso.datetime(),
});

/**
 * Where the offered id set came from. `live`, `cache`, and `snapshot` are the
 * shared models.dev catalog tiers. `provider-live` and `provider-cache` mean the
 * product's own model-list endpoint supplied the id set (fetched now, or from
 * the five-minute list cache) and models.dev only supplied metadata for the ids
 * it also knows.
 *
 * `cached` is the freshness flag discovery wire contracts expose. It is not
 * independent state: it is exactly `source === "cache" || source === "provider-cache"`.
 * Discriminating on `source` with a literal `cached` makes a contradictory pair
 * unrepresentable in the inferred type instead of merely rejected at parse time.
 */
export const ProviderModelsResponseSchema = z.discriminatedUnion("source", [
  ProviderModelsBaseSchema.extend({ source: z.literal("live"), cached: z.literal(false) }),
  ProviderModelsBaseSchema.extend({ source: z.literal("cache"), cached: z.literal(true) }),
  ProviderModelsBaseSchema.extend({ source: z.literal("snapshot"), cached: z.literal(false) }),
  ProviderModelsBaseSchema.extend({ source: z.literal("provider-live"), cached: z.literal(false) }),
  ProviderModelsBaseSchema.extend({ source: z.literal("provider-cache"), cached: z.literal(true) }),
]);

export type ProviderModelsResponse = z.infer<typeof ProviderModelsResponseSchema>;

const ConfigurationModelsBaseSchema = z.strictObject({
  configurationId: ConfigurationIdSchema,
  productId: RunnableProductIdSchema,
  transportFamily: TransportFamilySchema,
  checkedAt: z.iso.datetime(),
});

const PassedConfigurationModelsBaseSchema = ConfigurationModelsBaseSchema.extend({
  status: z.literal("passed"),
  models: z.array(ModelInfoSchema),
});

/**
 * Per-configuration catalog discovery wire contract for the model picker.
 * `passed` carries bounded catalog observations (never admission evidence) and
 * repeats the ProviderModelsResponse provenance discrimination; `skipped`
 * carries a registry-owned reason and no models at all.
 */
export const ConfigurationModelsResponseSchema = z.discriminatedUnion("status", [
  z.discriminatedUnion("source", [
    PassedConfigurationModelsBaseSchema.extend({
      source: z.literal("live"),
      cached: z.literal(false),
    }),
    PassedConfigurationModelsBaseSchema.extend({
      source: z.literal("cache"),
      cached: z.literal(true),
    }),
    PassedConfigurationModelsBaseSchema.extend({
      source: z.literal("snapshot"),
      cached: z.literal(false),
    }),
    PassedConfigurationModelsBaseSchema.extend({
      source: z.literal("provider-live"),
      cached: z.literal(false),
    }),
    PassedConfigurationModelsBaseSchema.extend({
      source: z.literal("provider-cache"),
      cached: z.literal(true),
    }),
  ]),
  ConfigurationModelsBaseSchema.extend({
    status: z.literal("skipped"),
    models: z.tuple([]),
    reason: z.string().min(1).max(512),
  }),
]);

export type ConfigurationModelsResponse = z.infer<typeof ConfigurationModelsResponseSchema>;
