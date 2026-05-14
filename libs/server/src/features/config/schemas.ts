import { z } from "zod";
import { AIProviderSchema } from "@diffgazer/core/schemas/config";

export const ProviderParamSchema = z.object({
  providerId: AIProviderSchema,
});

export const ActivateProviderBodySchema = z.object({
  model: z.string().min(1).optional(),
});
