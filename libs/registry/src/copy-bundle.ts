import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";
import { RegistrySchema } from "./registry-types.js";

export const CopyBundleItemSchema = z.object({
  name: z.string(),
  title: z.string(),
  description: z.string(),
  files: z.array(
    z.object({
      path: z.string(),
      content: z.string(),
    }),
  ),
});

export const CopyBundleSchema = z.object({
  items: z.array(CopyBundleItemSchema),
  integrity: z.string().optional(),
});

export type CopyBundleItem = z.infer<typeof CopyBundleItemSchema>;

export type CopyBundle = z.infer<typeof CopyBundleSchema>;

export interface BuildCopyBundleOptions {
  sourceRoot: string;
  outputPath: string;
  registryPath?: string;
  itemType: string;
  pathMapping?: { from: string; to: string };
  transformContent?: (content: string, sourcePath: string) => string;
}

export interface BuildCopyBundleResult {
  outputPath: string;
  itemCount: number;
  integrity: string;
}

// NOTE: Identical implementation exists in src/cli/integrity.ts.
// Intentionally duplicated so artifact generation and installer runtime stay decoupled.
export function computeIntegrity(content: string): string {
  return `sha256-${createHash("sha256").update(content).digest("hex")}`;
}

function normalizeFilePath(
  path: string,
  mapping?: { from: string; to: string },
): string {
  if (!mapping) return path;
  if (mapping.to && path.startsWith(mapping.to)) return path;
  if (path.startsWith(mapping.from)) {
    return path.replace(mapping.from, mapping.to);
  }
  throw new Error(
    `Unsupported file path "${path}". Expected "${mapping.from}*" or "${mapping.to}*".`,
  );
}

export function buildCopyBundle(
  options: BuildCopyBundleOptions,
): BuildCopyBundleResult {
  const {
    sourceRoot,
    outputPath,
    registryPath = "registry/registry.json",
    itemType,
    pathMapping,
    transformContent,
  } = options;

  const sourceRegistryPath = resolve(sourceRoot, registryPath);
  if (!existsSync(sourceRegistryPath)) {
    throw new Error(`Registry file not found: ${sourceRegistryPath}`);
  }

  const rawRegistry = JSON.parse(readFileSync(sourceRegistryPath, "utf-8")) as unknown;
  const registry = RegistrySchema.parse(rawRegistry);

  const items = registry.items
    .filter((item) => item.type === itemType && item.meta?.hidden !== true)
    .map((item) => ({
      name: item.name,
      title: item.title ?? item.name,
      description: item.description ?? "",
      files: item.files.map((file) => {
        const filePath = resolve(sourceRoot, file.path);
        if (!existsSync(filePath)) {
          throw new Error(`Source file not found: ${filePath}`);
        }
        const content = readFileSync(filePath, "utf-8");
        return {
          path: normalizeFilePath(file.path, pathMapping),
          content: transformContent ? transformContent(content, file.path) : content,
        };
      }),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const contentForIntegrity = JSON.stringify({ items });
  const integrity = computeIntegrity(contentForIntegrity);

  const bundle = CopyBundleSchema.parse({ items, integrity });
  writeFileSync(outputPath, `${JSON.stringify(bundle, null, 2)}\n`);

  return {
    outputPath,
    itemCount: items.length,
    integrity,
  };
}
