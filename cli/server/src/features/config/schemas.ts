import { AIProviderSchema } from "@diffgazer/core/schemas/config";
import { z } from "zod";

export const ProviderParamSchema = z.object({
  providerId: AIProviderSchema,
});

export const ActivateProviderBodySchema = z.object({
  model: z.string().min(1).optional(),
});

/**
 * GET /provider/:id/models keeps the route param permissive and lets the service
 * own provider-id semantics: unknown -> VALIDATION_ERROR/400, surfaced-but-disabled
 * (and OpenRouter, per D4) -> PROVIDER_DISABLED/404, enabled -> the catalog. This
 * keeps a single source of truth instead of validating the id at two layers.
 */
export const ProviderModelsParamSchema = z.object({ id: z.string().min(1) });
