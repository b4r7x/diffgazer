import { existsSync, readdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { z } from "zod";

export const ArtifactSourceSchema = z.object({
  workspaceDir: z.string().min(1),
  packageName: z.string().min(1),
});

export const DocsLibrariesSchema = z.object({
  primaryLibraryId: z.string().min(1),
  libraries: z.array(z.object({
    id: z.string().min(1),
    enabled: z.boolean(),
    artifactSource: ArtifactSourceSchema.optional(),
  })).min(1),
});

export function parseDocsLibrariesConfig(rawConfig) {
  return DocsLibrariesSchema.parse(rawConfig);
}

export function readDocsLibrariesConfig(configPath) {
  return parseDocsLibrariesConfig(JSON.parse(readFileSync(configPath, "utf-8")));
}

export function getArtifactLibraries(docsLibraries) {
  return docsLibraries.libraries
    .filter((library) => library.enabled && library.artifactSource)
    .map((library) => ({
      id: library.id,
      packageName: library.artifactSource.packageName,
      workspaceDir: library.artifactSource.workspaceDir,
    }));
}

function makePackageResolver(resolveFromDir) {
  const requireFromDir = createRequire(resolve(resolveFromDir, "__docs-artifacts-resolver__.cjs"));

  return (packageName) => {
    try {
      requireFromDir.resolve(packageName);
      return true;
    } catch {
      return false;
    }
  };
}

export function resolveArtifactSyncMode(env = process.env, options = {}) {
  if (env.DIFFGAZER_DEV) return "workspace";

  const {
    libraries = [],
    resolveFromDir = process.cwd(),
    resolvePackage = makePackageResolver(resolveFromDir),
  } = options;

  if (env.CI) return "package";
  if (libraries.length === 0) return "package";

  const hasUnresolvableArtifactPackage = libraries.some((library) => !resolvePackage(library.packageName));

  return hasUnresolvableArtifactPackage ? "workspace" : "package";
}

function directoryHasFiles(dirPath) {
  const stack = [dirPath];

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current || !existsSync(current)) continue;

    for (const entry of readdirSync(current, { withFileTypes: true })) {
      if (entry.isFile()) return true;
      if (entry.isDirectory()) {
        stack.push(resolve(current, entry.name));
      }
    }
  }

  return false;
}

export function collectArtifactSyncValidationErrors(params) {
  const {
    docsRoot,
    primaryLibraryId,
    libraries,
  } = params;

  const errors = [];

  const libraryIds = libraries.map((library) => library.id);

  if (!libraryIds.includes(primaryLibraryId)) {
    errors.push(
      `Primary library "${primaryLibraryId}" is not present in enabled artifact libraries: ${libraryIds.join(", ") || "(none)"}`,
    );
  }

  const requiredRootFiles = [
    "content/docs/meta.json",
    "registry/registry.json",
    "styles/styles.css",
    "src/generated/demo-loaders.ts",
  ];

  for (const relPath of requiredRootFiles) {
    const absPath = resolve(docsRoot, relPath);
    if (!existsSync(absPath)) {
      errors.push(`Missing sync output: ${relPath}`);
    }
  }

  for (const libraryId of libraryIds) {
    const contentMetaRelPath = `content/docs/${libraryId}/meta.json`;
    const publicRegistryRelPath = `public/r/${libraryId}/registry.json`;
    const generatedNamespaceRelPath = `src/generated/${libraryId}`;

    if (!existsSync(resolve(docsRoot, contentMetaRelPath))) {
      errors.push(`Missing docs namespace content: ${contentMetaRelPath}`);
    }

    if (!existsSync(resolve(docsRoot, publicRegistryRelPath))) {
      errors.push(`Missing public registry namespace: ${publicRegistryRelPath}`);
    }

    const generatedNamespaceAbsPath = resolve(docsRoot, generatedNamespaceRelPath);
    if (!existsSync(generatedNamespaceAbsPath)) {
      errors.push(`Missing generated namespace: ${generatedNamespaceRelPath}`);
      continue;
    }

    if (!directoryHasFiles(generatedNamespaceAbsPath)) {
      errors.push(`Generated namespace is empty: ${generatedNamespaceRelPath}`);
    }
  }

  return errors;
}

export function assertArtifactSyncOutputs(params) {
  const errors = collectArtifactSyncValidationErrors(params);
  if (errors.length === 0) return;

  throw new Error(
    [
      "Artifact sync validation failed in docs host.",
      ...errors,
    ].join("\n"),
  );
}
