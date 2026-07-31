import { z } from "zod";
import { ExactModelIdSchema } from "../schemas/config/provider-config.js";

const OpaqueUpstreamIdSchema = z.string().min(1).max(512);
const LATEST_ALIAS_PATTERN = /(?:^|[/:._-])latest(?:$|[/:._-])/i;

const CATALOG_MODEL_NAME_MAX_BYTES = 512;
const MODEL_NAME_SECRET_PATTERN =
  /(?:\b(?:api(?:[-_ ]?key)|access[-_ ]?token|auth(?:orization)?|credential|password|passwd|secret|token|private[-_ ]?key)\b\s*(?::|=|\bis\s*)\s*[^\s,;)}\]]+|\b(?:bearer|basic)\s+[A-Za-z0-9+/_=.:-]{8,}|\b(?:sk|pk|rk|gsk|gh[pousr]|github_pat|AIza|ya29|xox[baprs]-)[A-Za-z0-9._~+\x2f-]{8,}=*)/i;
const MODEL_NAME_PATH_PATTERN =
  /(?:^|[\s"'`([{=:])(?:~[\\/]|\.{1,2}[\\/]|[A-Za-z]:[\\/]|\\\\|\/(?:Users|home|private\/var|var\/folders|tmp|usr|bin|srv|opt|etc)(?:[\\/]|$))/i;

function utf8ByteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

function containsUnsafeModelNameControl(value: string): boolean {
  return [...value].some((character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    return (
      codePoint <= 0x1f ||
      (codePoint >= 0x7f && codePoint <= 0x9f) ||
      codePoint === 0x2028 ||
      codePoint === 0x2029
    );
  });
}

function isSafeCatalogModelName(value: string): boolean {
  return (
    value.trim().length > 0 &&
    utf8ByteLength(value) <= CATALOG_MODEL_NAME_MAX_BYTES &&
    !containsUnsafeModelNameControl(value) &&
    !MODEL_NAME_SECRET_PATTERN.test(value) &&
    !MODEL_NAME_PATH_PATTERN.test(value)
  );
}

export const CatalogModelNameSchema = z
  .string()
  .min(1)
  .max(CATALOG_MODEL_NAME_MAX_BYTES)
  .refine(
    (name) => utf8ByteLength(name) <= CATALOG_MODEL_NAME_MAX_BYTES,
    "Catalog model names must be at most 512 UTF-8 bytes",
  )
  .refine(isSafeCatalogModelName, "Catalog model names must be safe display text");

export const CatalogSelectableModelIdSchema = ExactModelIdSchema.refine(
  (modelId) => !LATEST_ALIAS_PATTERN.test(modelId),
  "Marketing aliases are not exact model IDs",
);
export type CatalogSelectableModelId = z.infer<typeof CatalogSelectableModelIdSchema>;

export const CATALOG_OBSERVATION_SOURCES = ["models.dev-live", "models.dev-snapshot"] as const;
export const CatalogObservationSourceSchema = z.enum(CATALOG_OBSERVATION_SOURCES);
export type CatalogObservationSource = z.infer<typeof CatalogObservationSourceSchema>;

export const ModelsDevModelSchema = z.object({
  id: OpaqueUpstreamIdSchema,
  name: CatalogModelNameSchema.optional(),
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

export const CatalogObservationSchema = z.strictObject({
  source: CatalogObservationSourceSchema,
  checkedAt: z.iso.datetime(),
  catalog: ModelsDevCatalogSchema,
});
export type CatalogObservation = z.infer<typeof CatalogObservationSchema>;

const UNSAFE_RECORD_KEYS = new Set(["__proto__", "prototype", "constructor"]);

/**
 * Defensive parse: drop invalid models and providers so one bad upstream entry
 * can never empty the catalog.
 */
export function parseModelsDevCatalog(raw: unknown): ModelsDevCatalog {
  const catalog: ModelsDevCatalog = {};
  if (!raw || typeof raw !== "object") return catalog;

  for (const [providerId, rawProvider] of Object.entries(raw as Record<string, unknown>)) {
    if (UNSAFE_RECORD_KEYS.has(providerId)) continue;
    if (!rawProvider || typeof rawProvider !== "object") continue;
    const { models: rawModels, ...rest } = rawProvider as Record<string, unknown>;

    const models: Record<string, ModelsDevModel> = {};
    if (rawModels && typeof rawModels === "object") {
      for (const [modelId, rawModel] of Object.entries(rawModels as Record<string, unknown>)) {
        if (UNSAFE_RECORD_KEYS.has(modelId)) continue;
        const parsed = ModelsDevModelSchema.safeParse(rawModel);
        if (parsed.success) models[modelId] = parsed.data;
      }
    }

    const provider = ModelsDevProviderSchema.safeParse({ ...rest, models });
    if (provider.success) catalog[providerId] = provider.data;
  }

  return catalog;
}
