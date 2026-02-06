import { z } from "zod";
import { AIProviderSchema, SaveConfigRequestSchema } from "@stargazer/schemas/config";

export const SaveConfigSchema = SaveConfigRequestSchema;

export const ProviderParamSchema = z.object({
  providerId: AIProviderSchema,
});

export const ActivateProviderBodySchema = z.object({
  model: z.string().min(1).optional(),
});
