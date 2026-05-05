import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";
import { DEFAULT_ARTIFACT_ROOT, ARTIFACT_FINGERPRINT_FILENAME } from "./constants.js";
import { readJson } from "./utils/json.js";

export const ArtifactManifestDocsSchema = z.object({
  contentDir: z.string().min(1),
  metaFile: z.string().min(1),
  generatedDir: z.string().min(1).optional(),
  assetsDir: z.string().min(1).optional(),
});

export const ArtifactManifestRegistrySchema = z.object({
  namespace: z.string().regex(/^@[a-z0-9][\w-]*(?:\/[a-z0-9][\w-]*)?$/i),
  basePath: z.string().min(1),
  publicDir: z.string().min(1),
  index: z.string().min(1),
});

const ArtifactManifestSourceSchema = z.object({
  registryDir: z.string().min(1).optional(),
  stylesDir: z.string().min(1).optional(),
});

export const ArtifactManifestIntegritySchema = z.object({
  algorithm: z.literal("sha256"),
  fingerprintFile: z.string().min(1),
});

export const ArtifactManifestSchema = z.object({
  schemaVersion: z.literal(1),
  library: z.string().min(1),
  package: z.string().min(1),
  version: z.string().min(1),
  artifactRoot: z.string().min(1),
  inputs: z.array(z.string().min(1)).min(1),
  docs: ArtifactManifestDocsSchema,
  registry: ArtifactManifestRegistrySchema,
  source: ArtifactManifestSourceSchema.optional(),
  generated: z.record(z.string(), z.string()).optional(),
  integrity: ArtifactManifestIntegritySchema,
});

export type ArtifactManifest = z.infer<typeof ArtifactManifestSchema>;
export type ArtifactManifestDocs = z.infer<typeof ArtifactManifestDocsSchema>;
export type ArtifactManifestRegistry = z.infer<typeof ArtifactManifestRegistrySchema>;
export type ArtifactManifestIntegrity = z.infer<typeof ArtifactManifestIntegritySchema>;

interface ValidateManifestResult {
  success: true;
  data: ArtifactManifest;
}

interface ValidateManifestError {
  success: false;
  errors: string[];
}

export interface CreateArtifactManifestOptions {
  rootDir: string;
  library: string;
  packageName?: string;
  inputs: string[];
  docs: ArtifactManifestDocs;
  registry: ArtifactManifestRegistry;
  source?: z.infer<typeof ArtifactManifestSourceSchema>;
  generated?: Record<string, string>;
}

export function createArtifactManifest(options: CreateArtifactManifestOptions): ArtifactManifest {
  const pkg = readPackageJsonFields(options.rootDir);
  return {
    schemaVersion: 1,
    library: options.library,
    package: options.packageName ?? pkg.name ?? options.library,
    version: pkg.version ?? "0.0.0",
    artifactRoot: DEFAULT_ARTIFACT_ROOT,
    inputs: options.inputs,
    docs: options.docs,
    registry: options.registry,
    ...(options.source && { source: options.source }),
    ...(options.generated && { generated: options.generated }),
    integrity: { algorithm: "sha256", fingerprintFile: ARTIFACT_FINGERPRINT_FILENAME },
  };
}

export function validateManifest(data: unknown): ValidateManifestResult | ValidateManifestError {
  const result = ArtifactManifestSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return {
    success: false,
    errors: result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`),
  };
}

export function loadValidatedManifest(path: string, label: string): ArtifactManifest {
  const raw = readJson(path);
  const validation = validateManifest(raw);
  if (!validation.success) {
    throw new Error(
      `${label} manifest validation failed:\n${validation.errors.join("\n")}`,
    );
  }
  return validation.data;
}

const PackageJsonSchema = z.object({
  name: z.string().optional(),
  version: z.string().optional(),
});

function readPackageJsonFields(rootDir: string): { name?: string; version?: string } {
  return PackageJsonSchema.parse(
    JSON.parse(readFileSync(resolve(rootDir, "package.json"), "utf-8")),
  );
}
