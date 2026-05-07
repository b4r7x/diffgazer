import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { basename, relative, resolve } from "node:path";
import { z } from "zod";
import {
  collectPathParityErrors,
  collectTreeParityErrors,
} from "./artifact-validation-lib.mjs";

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

function toPosixPath(path) {
  return path.split(/[\\/]+/).join("/");
}

function getGeneratedFiles(artifact) {
  if (Array.isArray(artifact.generatedFiles)) return artifact.generatedFiles;
  return Object.values(artifact.manifest.generated ?? {});
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf-8"));
}

function resolveRegistryFilePath(registryDir, registryFilePath) {
  const relativePath = registryFilePath.replace(/^registry[\\/]/, "");
  return resolve(registryDir, relativePath);
}

function getRegistryCssFilePaths(artifact) {
  const registryDirRel = artifact.manifest.source?.registryDir;
  if (!registryDirRel) return [];

  const registryDir = resolve(artifact.artifactRoot, registryDirRel);
  const registryIndex = resolve(registryDir, "registry.json");
  if (!existsSync(registryIndex)) return [];

  const registry = readJson(registryIndex);
  const seen = new Set();
  const cssFiles = [];

  for (const item of registry.items ?? []) {
    if (item.type === "registry:theme") continue;
    for (const file of item.files ?? []) {
      if (typeof file.path !== "string" || !file.path.endsWith(".css")) continue;
      const cssPath = resolveRegistryFilePath(registryDir, file.path);
      if (seen.has(cssPath)) continue;
      seen.add(cssPath);
      cssFiles.push(cssPath);
    }
  }

  return cssFiles;
}

export function getMaterializedPrimaryStylesContent(artifact) {
  const stylesDirRel = artifact.manifest.source?.stylesDir;
  if (!stylesDirRel) return null;

  const stylesPath = resolve(artifact.artifactRoot, stylesDirRel, "styles.css");
  if (!existsSync(stylesPath)) return null;

  const seed = readFileSync(stylesPath, "utf-8")
    .replace(/^\/\* Canonical style seed\.[\s\S]*?\*\/\n?/, "/* Canonical materialized component CSS entry for the docs app. */\n")
    .trimEnd();
  const chunks = [seed];
  for (const cssPath of getRegistryCssFilePaths(artifact)) {
    if (existsSync(cssPath)) {
      chunks.push(readFileSync(cssPath, "utf-8").trimEnd());
    }
  }

  return `${chunks.filter(Boolean).join("\n\n")}\n`;
}

export function materializePrimaryStylesFromArtifact(docsRoot, artifact) {
  const materialized = getMaterializedPrimaryStylesContent(artifact);
  if (materialized == null) return;
  writeFileSync(resolve(docsRoot, "styles/styles.css"), materialized);
}

function collectArtifactOutputParityErrors(params) {
  const {
    docsRoot,
    primaryLibraryId,
    artifacts = [],
  } = params;
  const errors = [];
  const secondaryLibraryExamplePrefixes = artifacts
    .filter((artifact) => artifact.id !== primaryLibraryId)
    .map((artifact) => `examples/${artifact.id}/`);
  const primaryRegistryOutputDir = resolve(docsRoot, "registry");
  const primaryRegistryOutputFilter = (path) => {
    const relPath = `${toPosixPath(relative(primaryRegistryOutputDir, path))}/`;
    return !secondaryLibraryExamplePrefixes.some((prefix) => relPath.startsWith(prefix));
  };

  for (const artifact of artifacts) {
    const libraryId = artifact.id;

    errors.push(...collectTreeParityErrors(
      resolve(artifact.artifactRoot, artifact.manifest.docs.contentDir),
      resolve(docsRoot, "content/docs", libraryId),
      `${libraryId} docs content sync`,
    ));

    errors.push(...collectTreeParityErrors(
      resolve(artifact.artifactRoot, artifact.manifest.registry.publicDir),
      resolve(docsRoot, "public/r", libraryId),
      `${libraryId} public registry sync`,
    ));

    if (artifact.manifest.docs.assetsDir) {
      const artifactAssetsDir = resolve(artifact.artifactRoot, artifact.manifest.docs.assetsDir);
      const outputAssetsDir = resolve(docsRoot, "public/library-assets", libraryId);
      if (existsSync(artifactAssetsDir)) {
        errors.push(...collectTreeParityErrors(
          artifactAssetsDir,
          outputAssetsDir,
          `${libraryId} assets sync`,
        ));
      } else if (existsSync(outputAssetsDir) && directoryHasFiles(outputAssetsDir)) {
        errors.push(`${libraryId} assets sync: stale output directory ${outputAssetsDir}`);
      }
    }

    if (libraryId === primaryLibraryId) {
      if (artifact.manifest.docs.generatedDir) {
        errors.push(...collectTreeParityErrors(
          resolve(artifact.artifactRoot, artifact.manifest.docs.generatedDir),
          resolve(docsRoot, "src/generated", libraryId),
          `${libraryId} generated sync`,
        ));
      }

      if (artifact.manifest.source?.registryDir) {
        errors.push(...collectTreeParityErrors(
          resolve(artifact.artifactRoot, artifact.manifest.source.registryDir),
          resolve(docsRoot, "registry"),
          `${libraryId} source registry sync`,
          { artifactFilter: primaryRegistryOutputFilter },
        ));
      }

      if (artifact.manifest.source?.stylesDir) {
        const artifactStylesDir = resolve(artifact.artifactRoot, artifact.manifest.source.stylesDir);
        const docsStylesDir = resolve(docsRoot, "styles");
        errors.push(...collectTreeParityErrors(
          artifactStylesDir,
          docsStylesDir,
          `${libraryId} styles sync`,
          {
            sourceFilter: (path) => basename(path) !== "styles.css",
            artifactFilter: (path) => basename(path) !== "styles.css",
          },
        ));

        const expectedStyles = getMaterializedPrimaryStylesContent(artifact);
        if (expectedStyles != null) {
          const actualStylesPath = resolve(docsStylesDir, "styles.css");
          const actualStyles = existsSync(actualStylesPath)
            ? readFileSync(actualStylesPath, "utf-8")
            : null;
          if (actualStyles !== expectedStyles) {
            errors.push(`${libraryId} styles sync: materialized styles.css differs from artifact source styles plus registry CSS`);
          }
        }
      }

      continue;
    }

    for (const generatedFile of getGeneratedFiles(artifact)) {
      errors.push(...collectPathParityErrors(
        resolve(artifact.artifactRoot, generatedFile),
        resolve(docsRoot, "src/generated", libraryId, basename(generatedFile)),
        `${libraryId} generated sync ${generatedFile}`,
      ));
    }
  }

  return errors;
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

  errors.push(...collectArtifactOutputParityErrors(params));

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
