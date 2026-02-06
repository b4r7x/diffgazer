import { z } from "zod";
import { AIProviderSchema } from "@stargazer/schemas/config";

export const saveConfigSchema = z.object({
  provider: AIProviderSchema,
  apiKey: z.string().min(1),
  model: z.string().min(1).optional(),
});

export const providerParamSchema = z.object({
  providerId: AIProviderSchema,
});

export const activateProviderBodySchema = z.object({
  model: z.string().min(1).optional(),
});
