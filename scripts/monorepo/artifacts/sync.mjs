import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import { assertSafeLibraryId } from "./config.mjs";
import { readJson } from "./json.mjs";
import { resolveInside } from "./paths.mjs";
import { collectPathParityErrors, collectTreeParityErrors } from "./validation.mjs";

export {
  getArtifactLibraries,
  parseDocsLibrariesConfig,
  readDocsLibrariesConfig,
  resolveArtifactSyncMode,
} from "./config.mjs";

export function collectMissingWorkspaceArtifactFiles(workspaceRoot, libraries) {
  return libraries.flatMap((library) => {
    assertSafeLibraryId(library.id, `${library.id} artifact library id`);
    const libraryRoot = resolveInside(
      workspaceRoot,
      library.workspaceDir,
      `${library.id} workspace directory`,
    );
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

function collectBaseOutputErrors(docsRoot, artifact) {
  const libraryId = artifact.id;

  return [
    ...collectTreeParityErrors(
      resolveInside(
        artifact.artifactRoot,
        artifact.manifest.docs.contentDir,
        `${libraryId} docs content artifact path`,
      ),
      resolve(docsRoot, "content/docs", libraryId),
      `${libraryId} docs content sync`,
    ),
    ...collectTreeParityErrors(
      resolveInside(
        artifact.artifactRoot,
        artifact.manifest.registry.publicDir,
        `${libraryId} public registry artifact path`,
      ),
      resolve(docsRoot, "public/r", libraryId),
      `${libraryId} public registry sync`,
    ),
  ];
}

function collectAssetOutputErrors(docsRoot, artifact) {
  if (!artifact.manifest.docs.assetsDir) return [];

  const libraryId = artifact.id;
  const artifactAssetsDir = resolveInside(
    artifact.artifactRoot,
    artifact.manifest.docs.assetsDir,
    `${libraryId} assets artifact path`,
  );
  const outputAssetsDir = resolve(docsRoot, "public/library-assets", libraryId);
  if (existsSync(artifactAssetsDir)) {
    return collectTreeParityErrors(artifactAssetsDir, outputAssetsDir, `${libraryId} assets sync`);
  }
  if (existsSync(outputAssetsDir) && directoryHasFiles(outputAssetsDir)) {
    return [`${libraryId} assets sync: stale output directory ${outputAssetsDir}`];
  }
  return [];
}

function collectPrimaryGeneratedErrors(docsRoot, artifact) {
  if (!artifact.manifest.docs.generatedDir) return [];

  const artifactGeneratedDir = resolveInside(
    artifact.artifactRoot,
    artifact.manifest.docs.generatedDir,
    `${artifact.id} generated artifact path`,
  );
  const outputGeneratedDir = resolve(docsRoot, "src/generated", artifact.id);
  const isNotDemoIndex = (filePath) => basename(filePath) !== "demo-index.ts";

  const errors = [
    ...collectTreeParityErrors(
      artifactGeneratedDir,
      outputGeneratedDir,
      `${artifact.id} generated sync`,
      {
        sourceFilter: isNotDemoIndex,
        artifactFilter: isNotDemoIndex,
      },
    ),
  ];

  if (artifact.manifest.generated?.demoIndex) {
    errors.push(
      ...collectGeneratedDemoIndexErrors(
        resolve(artifactGeneratedDir, "demo-index.ts"),
        resolve(outputGeneratedDir, "demo-index.ts"),
        `${artifact.id} generated sync demo-index.ts`,
        (content) => rewriteDemoIndexForViteGlob(content),
      ),
    );
  }

  return errors;
}

export function rewriteDemoIndexForViteGlob(content) {
  const entries = Array.from(
    content.matchAll(/^\s+"([^"]+)": lazy\(\(\) => import\("([^"]+)"\)\),$/gm),
  );
  if (entries.length === 0) return content;

  return [
    `import { lazy } from "react"`,
    `import type { ComponentType, LazyExoticComponent } from "react"`,
    "",
    "type DemoModule = { default: ComponentType }",
    `const demoModules = import.meta.glob<DemoModule>("../../../registry/examples/**/*.tsx")`,
    "",
    "function lazyDemo(path: string): LazyExoticComponent<ComponentType> {",
    "  const load = demoModules[path]",
    "  if (!load) {",
    "    return lazy(() => Promise.reject(new Error(`Missing demo module: ${path}`)))",
    "  }",
    "  return lazy(load)",
    "}",
    "",
    "export const demos: Record<string, LazyExoticComponent<ComponentType>> = {",
    ...entries.map(([, demoName, importPath]) => {
      return `  "${demoName}": lazyDemo("${importPath}.tsx"),`;
    }),
    "}",
    "",
  ].join("\n");
}

function collectSecondaryGeneratedErrors(docsRoot, artifact) {
  const generatedFiles = Array.isArray(artifact.generatedFiles)
    ? artifact.generatedFiles
    : Object.values(artifact.manifest.generated ?? {});

  return generatedFiles.flatMap((generatedFile) =>
    collectSecondaryGeneratedFileErrors(docsRoot, artifact, generatedFile),
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
    return collectTreeParityErrors(examplesDir, outputDir, `${artifact.id} examples sync`);
  }
  if (existsSync(outputDir) && directoryHasFiles(outputDir)) {
    return [`${artifact.id} examples sync: stale output directory ${outputDir}`];
  }
  return [];
}

export function rewriteSecondaryDemoIndexImports(content, libraryId) {
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

function collectGeneratedDemoIndexErrors(artifactPath, outputPath, label, rewriteExpected) {
  if (!existsSync(artifactPath)) {
    return [`${label}: missing source path ${artifactPath}`];
  }
  if (!existsSync(outputPath)) {
    return [`${label}: missing artifact path ${outputPath}`];
  }

  const expected = rewriteExpected(readFileSync(artifactPath, "utf-8"));
  const actual = readFileSync(outputPath, "utf-8");
  return expected === actual
    ? []
    : [`${label}: artifact differs from rewritten docs runtime demo index`];
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

  return collectGeneratedDemoIndexErrors(artifactPath, outputPath, label, (content) =>
    rewriteDemoIndexForViteGlob(rewriteSecondaryDemoIndexImports(content, artifact.id)),
  );
}

function collectArtifactOutputParityErrors(params) {
  const { docsRoot, primaryLibraryId, artifacts = [] } = params;
  const errors = [];

  for (const artifact of artifacts) {
    try {
      errors.push(...collectBaseOutputErrors(docsRoot, artifact));
      errors.push(...collectAssetOutputErrors(docsRoot, artifact));

      if (artifact.id === primaryLibraryId) {
        errors.push(...collectPrimaryGeneratedErrors(docsRoot, artifact));
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
  const { docsRoot, primaryLibraryId, libraries } = params;

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

  const requiredRootFiles = ["content/docs/meta.json", "src/generated/demo-loaders.ts"];

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
    const contentMetaPath = resolveInside(
      docsRoot,
      contentMetaRelPath,
      `${libraryId} docs namespace content output`,
    );
    const publicRegistryPath = resolveInside(
      docsRoot,
      publicRegistryRelPath,
      `${libraryId} public registry namespace output`,
    );
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

  throw new Error(["Artifact sync validation failed in docs host.", ...errors].join("\n"));
}
