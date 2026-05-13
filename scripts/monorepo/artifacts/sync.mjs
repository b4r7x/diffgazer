import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, relative, resolve } from "node:path";
import { assertSafeLibraryId } from "./config.mjs";
import { readJson } from "./json.mjs";
import { resolveInside, toPosixPath } from "./paths.mjs";
import {
  collectPathParityErrors,
  collectTreeParityErrors,
} from "./validation.mjs";

export {
  getArtifactLibraries,
  parseDocsLibrariesConfig,
  readDocsLibrariesConfig,
  resolveArtifactSyncMode,
} from "./config.mjs";

export function collectMissingWorkspaceArtifactFiles(workspaceRoot, libraries) {
  return libraries.flatMap((library) => {
    assertSafeLibraryId(library.id, `${library.id} artifact library id`);
    const libraryRoot = resolveInside(workspaceRoot, library.workspaceDir, `${library.id} workspace directory`);
    const artifactRoot = resolve(libraryRoot, "dist/artifacts");
    const manifestRelPath = `${library.workspaceDir}/dist/artifacts/artifact-manifest.json`;
    const manifestPath = resolve(workspaceRoot, manifestRelPath);
    const missing = [];

    function addMissing(relPath) {
      const path = resolve(workspaceRoot, relPath);
      if (!existsSync(path)) {
        missing.push({ id: library.id, path, relativePath: relPath });
      }
    }

    addMissing(manifestRelPath);
    addMissing(`${library.workspaceDir}/dist/artifacts/fingerprint.sha256`);

    if (!existsSync(manifestPath)) return missing;

    const manifest = readJson(manifestPath);
    const expectedArtifactPaths = [
      manifest.docs?.contentDir,
      manifest.docs?.metaFile,
      manifest.docs?.assetsDir,
      manifest.docs?.generatedDir,
      manifest.registry?.publicDir,
      manifest.registry?.index,
      manifest.source?.registryDir,
      manifest.source?.stylesDir,
      ...Object.values(manifest.generated ?? {}),
    ].filter((relPath) => typeof relPath === "string" && relPath.length > 0);

    for (const relPath of expectedArtifactPaths) {
      const artifactPath = resolveInside(artifactRoot, relPath, `${library.id} artifact path`);
      if (!existsSync(artifactPath)) {
        missing.push({
          id: library.id,
          path: artifactPath,
          relativePath: `${library.workspaceDir}/dist/artifacts/${relPath}`,
        });
      }
    }

    return missing;
  });
}

function directoryHasFiles(dirPath) {
  const stack = [dirPath];

  while (stack.length > 0) {
    const current = stack.pop();
    if (!existsSync(current)) continue;

    for (const entry of readdirSync(current, { withFileTypes: true })) {
      if (entry.isFile()) return true;
      if (entry.isDirectory()) {
        stack.push(resolve(current, entry.name));
      }
    }
  }

  return false;
}

function resolveRegistryFilePath(registryDir, registryFilePath) {
  const relativePath = registryFilePath.replace(/^registry[\\/]/, "");
  return resolveInside(registryDir, relativePath, `registry CSS file path ${registryFilePath}`);
}

function getRegistryCssFilePaths(artifact) {
  const registryDirRel = artifact.manifest.source?.registryDir;
  if (!registryDirRel) return [];

  const registryDir = resolveInside(artifact.artifactRoot, registryDirRel, `${artifact.id} source registry path`);
  const registryIndex = resolveInside(registryDir, "registry.json", `${artifact.id} source registry index`);
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

  const stylesDir = resolveInside(artifact.artifactRoot, stylesDirRel, `${artifact.id} source styles path`);
  const stylesPath = resolveInside(stylesDir, "styles.css", `${artifact.id} source styles entry`);
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

function createPrimaryRegistryOutputFilter(docsRoot, primaryLibraryId, artifacts) {
  const secondaryLibraryExamplePrefixes = artifacts
    .filter((artifact) => artifact.id !== primaryLibraryId)
    .map((artifact) => `examples/${artifact.id}/`);
  const primaryRegistryOutputDir = resolve(docsRoot, "registry");

  return (path) => {
    const relPath = `${toPosixPath(relative(primaryRegistryOutputDir, path))}/`;
    return !secondaryLibraryExamplePrefixes.some((prefix) => relPath.startsWith(prefix));
  };
}

function collectBaseOutputErrors(docsRoot, artifact) {
  const libraryId = artifact.id;

  return [
    ...collectTreeParityErrors(
      resolveInside(artifact.artifactRoot, artifact.manifest.docs.contentDir, `${libraryId} docs content artifact path`),
      resolve(docsRoot, "content/docs", libraryId),
      `${libraryId} docs content sync`,
    ),
    ...collectTreeParityErrors(
      resolveInside(artifact.artifactRoot, artifact.manifest.registry.publicDir, `${libraryId} public registry artifact path`),
      resolve(docsRoot, "public/r", libraryId),
      `${libraryId} public registry sync`,
    ),
  ];
}

function collectAssetOutputErrors(docsRoot, artifact) {
  if (!artifact.manifest.docs.assetsDir) return [];

  const libraryId = artifact.id;
  const artifactAssetsDir = resolveInside(artifact.artifactRoot, artifact.manifest.docs.assetsDir, `${libraryId} assets artifact path`);
  const outputAssetsDir = resolve(docsRoot, "public/library-assets", libraryId);
  if (existsSync(artifactAssetsDir)) {
    return collectTreeParityErrors(
      artifactAssetsDir,
      outputAssetsDir,
      `${libraryId} assets sync`,
    );
  }
  if (existsSync(outputAssetsDir) && directoryHasFiles(outputAssetsDir)) {
    return [`${libraryId} assets sync: stale output directory ${outputAssetsDir}`];
  }
  return [];
}

function collectPrimaryGeneratedErrors(docsRoot, artifact) {
  if (!artifact.manifest.docs.generatedDir) return [];

  return collectTreeParityErrors(
    resolveInside(artifact.artifactRoot, artifact.manifest.docs.generatedDir, `${artifact.id} generated artifact path`),
    resolve(docsRoot, "src/generated", artifact.id),
    `${artifact.id} generated sync`,
  );
}

function collectPrimarySourceRegistryErrors(docsRoot, artifact, primaryRegistryOutputFilter) {
  if (!artifact.manifest.source?.registryDir) return [];

  return collectTreeParityErrors(
    resolveInside(artifact.artifactRoot, artifact.manifest.source.registryDir, `${artifact.id} source registry artifact path`),
    resolve(docsRoot, "registry"),
    `${artifact.id} source registry sync`,
    { artifactFilter: primaryRegistryOutputFilter },
  );
}

function collectPrimaryStyleErrors(docsRoot, artifact) {
  if (!artifact.manifest.source?.stylesDir) return [];

  const libraryId = artifact.id;
  const artifactStylesDir = resolveInside(artifact.artifactRoot, artifact.manifest.source.stylesDir, `${libraryId} source styles artifact path`);
  const docsStylesDir = resolve(docsRoot, "styles");
  const errors = collectTreeParityErrors(
    artifactStylesDir,
    docsStylesDir,
    `${libraryId} styles sync`,
    {
      sourceFilter: (path) => basename(path) !== "styles.css",
      artifactFilter: (path) => basename(path) !== "styles.css",
    },
  );

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

  return errors;
}

function collectSecondaryGeneratedErrors(docsRoot, artifact) {
  const generatedFiles = Array.isArray(artifact.generatedFiles)
    ? artifact.generatedFiles
    : Object.values(artifact.manifest.generated ?? {});

  return generatedFiles.flatMap((generatedFile) =>
    collectSecondaryGeneratedFileErrors(
      docsRoot,
      artifact,
      generatedFile,
    )
  );
}

function collectSecondaryExampleErrors(docsRoot, artifact) {
  const registryDirRel = artifact.manifest.source?.registryDir;
  if (!registryDirRel) return [];

  const examplesDir = resolveInside(
    artifact.artifactRoot,
    `${registryDirRel}/examples`,
    `${artifact.id} examples artifact path`,
  );
  const outputDir = resolve(docsRoot, "registry/examples", artifact.id);

  if (existsSync(examplesDir)) {
    return collectTreeParityErrors(
      examplesDir,
      outputDir,
      `${artifact.id} examples sync`,
    );
  }
  if (existsSync(outputDir) && directoryHasFiles(outputDir)) {
    return [`${artifact.id} examples sync: stale output directory ${outputDir}`];
  }
  return [];
}

function rewriteSecondaryDemoIndexImports(content, libraryId) {
  return content.replace(
    /import\("([^"]*?registry\/examples\/)([^"]+)"\)/g,
    (_match, _prefix, examplePath) => {
      const namespacedExamplePath = examplePath.startsWith(`${libraryId}/`)
        ? examplePath
        : `${libraryId}/${examplePath}`;
      return `import("../../../registry/examples/${namespacedExamplePath}")`;
    },
  );
}

function collectSecondaryGeneratedFileErrors(docsRoot, artifact, generatedFile) {
  const artifactPath = resolveInside(
    artifact.artifactRoot,
    generatedFile,
    `${artifact.id} generated artifact path ${generatedFile}`,
  );
  const outputPath = resolve(docsRoot, "src/generated", artifact.id, basename(generatedFile));
  const label = `${artifact.id} generated sync ${generatedFile}`;

  if (basename(generatedFile) !== "demo-index.ts") {
    return collectPathParityErrors(artifactPath, outputPath, label);
  }

  if (!existsSync(artifactPath)) {
    return [`${label}: missing source path ${artifactPath}`];
  }
  if (!existsSync(outputPath)) {
    return [`${label}: missing artifact path ${outputPath}`];
  }

  const expected = rewriteSecondaryDemoIndexImports(readFileSync(artifactPath, "utf-8"), artifact.id);
  const actual = readFileSync(outputPath, "utf-8");
  return expected === actual ? [] : [`${label}: artifact differs from rewritten secondary demo index`];
}

function collectArtifactOutputParityErrors(params) {
  const {
    docsRoot,
    primaryLibraryId,
    artifacts = [],
  } = params;
  const errors = [];
  const primaryRegistryOutputFilter = createPrimaryRegistryOutputFilter(docsRoot, primaryLibraryId, artifacts);

  for (const artifact of artifacts) {
    try {
      errors.push(...collectBaseOutputErrors(docsRoot, artifact));
      errors.push(...collectAssetOutputErrors(docsRoot, artifact));

      if (artifact.id === primaryLibraryId) {
        errors.push(...collectPrimaryGeneratedErrors(docsRoot, artifact));
        errors.push(...collectPrimarySourceRegistryErrors(docsRoot, artifact, primaryRegistryOutputFilter));
        errors.push(...collectPrimaryStyleErrors(docsRoot, artifact));
      } else {
        errors.push(...collectSecondaryGeneratedErrors(docsRoot, artifact));
        errors.push(...collectSecondaryExampleErrors(docsRoot, artifact));
      }
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
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
  try {
    assertSafeLibraryId(primaryLibraryId, "Primary library id");
    for (const libraryId of libraryIds) {
      assertSafeLibraryId(libraryId, `Library id "${libraryId}"`);
    }
    for (const artifact of params.artifacts ?? []) {
      assertSafeLibraryId(artifact.id, `Artifact id "${artifact.id}"`);
    }
  } catch (error) {
    return [error instanceof Error ? error.message : String(error)];
  }

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
    const contentMetaPath = resolveInside(docsRoot, contentMetaRelPath, `${libraryId} docs namespace content output`);
    const publicRegistryPath = resolveInside(docsRoot, publicRegistryRelPath, `${libraryId} public registry namespace output`);
    const generatedNamespaceAbsPath = resolveInside(
      docsRoot,
      generatedNamespaceRelPath,
      `${libraryId} generated namespace output`,
    );

    if (!existsSync(contentMetaPath)) {
      errors.push(`Missing docs namespace content: ${contentMetaRelPath}`);
    }

    if (!existsSync(publicRegistryPath)) {
      errors.push(`Missing public registry namespace: ${publicRegistryRelPath}`);
    }

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
