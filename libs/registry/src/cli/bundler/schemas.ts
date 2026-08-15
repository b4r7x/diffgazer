import { z } from "zod";
import { RegistryFileSchema, RegistryItemSchema } from "../registry.js";

const RegistrySourceFileSchema = RegistryFileSchema.pick({
  path: true,
  type: true,
  target: true,
});

const RegistrySourceItemSchema = RegistryItemSchema.extend({
  files: z.array(RegistrySourceFileSchema),
});

export const RegistrySourceSchema = z.object({
  items: z.array(RegistrySourceItemSchema),
});

export type RegistrySourceItem = z.infer<typeof RegistrySourceItemSchema>;
