import { z } from "zod";

export const ModelsDevModelSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  family: z.string().optional(),
  cost: z
    .object({
      input: z.number(),
      output: z.number(),
      cache_read: z.number().optional(),
      cache_write: z.number().optional(),
    })
    .optional(),
  limit: z
    .object({
      context: z.number().optional(),
      output: z.number().optional(),
    })
    .optional(),
  tool_call: z.boolean().optional(),
  structured_output: z.boolean().nullable().optional(),
  reasoning: z.boolean().optional(),
  modalities: z
    .object({
      input: z.array(z.string()).optional(),
      output: z.array(z.string()).optional(),
    })
    .optional(),
  release_date: z.string().optional(),
  last_updated: z.string().optional(),
  knowledge: z.string().optional(),
});
export type ModelsDevModel = z.infer<typeof ModelsDevModelSchema>;

export const ModelsDevProviderSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  api: z.string().nullable().optional(),
  env: z.array(z.string()).optional(),
  models: z.record(z.string(), ModelsDevModelSchema),
});

export const ModelsDevCatalogSchema = z.record(z.string(), ModelsDevProviderSchema);
export type ModelsDevCatalog = z.infer<typeof ModelsDevCatalogSchema>;

/**
 * Defensive parse: drop invalid models and providers so one bad upstream entry
 * can never empty the catalog.
 */
export function parseModelsDevCatalog(raw: unknown): ModelsDevCatalog {
  const catalog: ModelsDevCatalog = {};
  if (!raw || typeof raw !== "object") return catalog;

  for (const [providerId, rawProvider] of Object.entries(raw as Record<string, unknown>)) {
    if (!rawProvider || typeof rawProvider !== "object") continue;
    const { models: rawModels, ...rest } = rawProvider as Record<string, unknown>;

    const models: Record<string, ModelsDevModel> = {};
    if (rawModels && typeof rawModels === "object") {
      for (const [modelId, rawModel] of Object.entries(rawModels as Record<string, unknown>)) {
        const parsed = ModelsDevModelSchema.safeParse(rawModel);
        if (parsed.success) models[modelId] = parsed.data;
      }
    }

    const provider = ModelsDevProviderSchema.safeParse({ ...rest, models });
    if (provider.success) catalog[providerId] = provider.data;
  }

  return catalog;
}
