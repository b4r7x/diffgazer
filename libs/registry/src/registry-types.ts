import { z } from "zod";

export const RegistryFileSchema = z.object({
  path: z.string(),
  type: z.string().optional(),
  content: z.string().optional(),
});

// NOTE: A near-identical installer schema exists in src/cli/registry.ts.
// Intentionally duplicated because artifact manifests and installer bundles have different validation needs.
export const RegistryItemSchema = z.object({
  name: z.string(),
  type: z.string(),
  title: z.string().optional(),
  description: z.string().optional(),
  files: z.array(RegistryFileSchema),
  dependencies: z.array(z.string()).default([]),
  registryDependencies: z.array(z.string()).default([]),
  meta: z.record(z.string(), z.unknown()).optional(),
});

export const RegistrySchema = z.object({
  name: z.string().optional(),
  items: z.array(RegistryItemSchema),
});

export type RegistryFile = z.infer<typeof RegistryFileSchema>;
export type RegistryItem = z.infer<typeof RegistryItemSchema>;
export type Registry = z.infer<typeof RegistrySchema>;
