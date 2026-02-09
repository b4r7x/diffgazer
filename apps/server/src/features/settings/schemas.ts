import { z } from "zod";
import { SettingsConfigSchema } from "@diffgazer/schemas/config";

export const SettingsSchema = SettingsConfigSchema.partial();

export const ProjectIdQuerySchema = z.object({
  projectId: z.string().min(1),
});
