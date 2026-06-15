import { z } from "zod";

// Registry item/file `type` values used across the handoff pipelines. The zod
// fields below stay `z.string()` so foreign shadcn JSON still round-trips; these
// typed constants replace the freeform string-literal comparisons so a typo
// fails the compiler instead of silently mis-filtering.
export type RegistryItemType =
  | "registry:ui"
  | "registry:hook"
  | "registry:lib"
  | "registry:style"
  | "registry:theme"
  | "registry:file";

export const REGISTRY_ITEM_TYPE = {
  ui: "registry:ui",
  hook: "registry:hook",
  lib: "registry:lib",
  style: "registry:style",
  theme: "registry:theme",
  file: "registry:file",
} as const satisfies Record<string, RegistryItemType>;

export const RegistryFileSchema = z.object({
  path: z.string(),
  content: z.string().optional(),
  type: z.string().optional(),
  target: z.string().optional(),
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
  // shadcn-compatible fields: preserved for public registry round-trip compatibility.
  devDependencies: z.array(z.string()).optional(),
  cssVars: z.record(z.string(), z.unknown()).optional(),
  css: z.string().optional(),
  envVars: z.array(z.string()).optional(),
  docs: z.string().optional(),
  categories: z.array(z.string()).optional(),
  author: z.string().optional(),
});

export const RegistrySchema = z.object({
  name: z.string().optional(),
  items: z.array(RegistryItemSchema),
});

export type RegistryFile = z.infer<typeof RegistryFileSchema>;
export type RegistryItem = z.infer<typeof RegistryItemSchema>;
export type Registry = z.infer<typeof RegistrySchema>;
