import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import type { ArtifactManifest } from "../manifest.js";
import { resolveInside } from "../utils/fs.js";
import type { ArtifactLibrary } from "./docs-libraries-config.js";
import { resolveArtifactPath } from "./artifact-availability.js";
import {
  rewriteDemoIndexForViteGlob,
  rewriteSecondaryDemoIndexImports,
} from "./demo-index-rewrite.js";
import { assertSafeLibraryId } from "./library-id-validation.js";
import { collectPathParityErrors, collectTreeParityErrors } from "./path-parity.js";

type ArtifactSyncManifest = {
  docs?: Partial<ArtifactManifest["docs"]>;
  registry?: Partial<ArtifactManifest["registry"]>;
  source?: ArtifactManifest["source"];
  generated?: ArtifactManifest["generated"];
};

interface LoadedArtifact {
  id: string;
  artifactRoot: string;
  manifest: ArtifactSyncManifest;
  generatedFiles?: string[];
}

function directoryHasFiles(dirPath: string): boolean {
  const stack = [dirPath];

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current || !existsSync(current)) continue;

    for (const entry of readdirSync(current, { withFileTypes: true })) {
      if (entry.isFile()) return true;
      if (entry.isDirectory()) stack.push(resolve(current, entry.name));
    }
  }

  return false;
}

function collectGeneratedDemoIndexErrors(
  artifactPath: string,
  outputPath: string,
  label: string,
  rewriteExpected: (content: string) => string,
): string[] {
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

function collectBaseOutputErrors(docsRoot: string, artifact: LoadedArtifact): string[] {
  const libraryId = artifact.id;
  const docsContentDir = artifact.manifest.docs?.contentDir;
  const publicRegistryDir = artifact.manifest.registry?.publicDir;

  if (typeof docsContentDir !== "string") return [`${libraryId} manifest missing docs.contentDir`];
  if (typeof publicRegistryDir !== "string") {
    return [`${libraryId} manifest missing registry.publicDir`];
  }

  return [
    ...collectTreeParityErrors(
      resolveArtifactPath(
        artifact.artifactRoot,
        docsContentDir,
        `${libraryId} docs content artifact path`,
      ),
      resolve(docsRoot, "content/docs", libraryId),
      `${libraryId} docs content sync`,
    ),
    ...collectTreeParityErrors(
      resolveArtifactPath(
        artifact.artifactRoot,
        publicRegistryDir,
        `${libraryId} public registry artifact path`,
      ),
      resolve(docsRoot, "public/r", libraryId),
      `${libraryId} public registry sync`,
    ),
  ];
}

function collectAssetOutputErrors(docsRoot: string, artifact: LoadedArtifact): string[] {
  const libraryId = artifact.id;
  const outputAssetsDir = resolve(docsRoot, "public/library-assets", libraryId);
  if (!artifact.manifest.docs?.assetsDir) {
    return existsSync(outputAssetsDir) && directoryHasFiles(outputAssetsDir)
      ? [`${libraryId} assets sync: stale output directory ${outputAssetsDir}`]
      : [];
  }

  const artifactAssetsDir = resolveArtifactPath(
    artifact.artifactRoot,
    artifact.manifest.docs.assetsDir,
    `${libraryId} assets artifact path`,
  );
  if (existsSync(artifactAssetsDir)) {
    return collectTreeParityErrors(artifactAssetsDir, outputAssetsDir, `${libraryId} assets sync`);
  }
  if (existsSync(outputAssetsDir) && directoryHasFiles(outputAssetsDir)) {
    return [`${libraryId} assets sync: stale output directory ${outputAssetsDir}`];
  }
  return [];
}

function collectPrimaryGeneratedErrors(docsRoot: string, artifact: LoadedArtifact): string[] {
  if (!artifact.manifest.docs?.generatedDir) return [];

  const artifactGeneratedDir = resolveArtifactPath(
    artifact.artifactRoot,
    artifact.manifest.docs.generatedDir,
    `${artifact.id} generated artifact path`,
  );
  const outputGeneratedDir = resolve(docsRoot, "src/generated", artifact.id);
  const isNotDemoIndex = (filePath: string) => basename(filePath) !== "demo-index.ts";

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

function collectSecondaryGeneratedFileErrors(
  docsRoot: string,
  artifact: LoadedArtifact,
  generatedFile: string,
): string[] {
  const artifactPath = resolveArtifactPath(
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

function collectSecondaryGeneratedErrors(docsRoot: string, artifact: LoadedArtifact): string[] {
  const generatedFiles = Array.isArray(artifact.generatedFiles)
    ? artifact.generatedFiles
    : Object.values(artifact.manifest.generated ?? {});

  return generatedFiles.flatMap((generatedFile) =>
    collectSecondaryGeneratedFileErrors(docsRoot, artifact, generatedFile),
  );
}

function collectSecondaryExampleErrors(docsRoot: string, artifact: LoadedArtifact): string[] {
  const registryDirRel = artifact.manifest.source?.registryDir;
  if (!registryDirRel) return [];

  const examplesDir = resolveArtifactPath(
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

interface ArtifactOutputParityParams {
  docsRoot: string;
  primaryLibraryId: string;
  artifacts?: LoadedArtifact[];
}

function collectArtifactOutputParityErrors(params: ArtifactOutputParityParams): string[] {
  const { docsRoot, primaryLibraryId, artifacts = [] } = params;
  const errors: string[] = [];

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

export interface ArtifactSyncValidationParams {
  docsRoot: string;
  primaryLibraryId: string;
  libraries: ArtifactLibrary[];
  artifacts?: LoadedArtifact[];
}

export function collectArtifactSyncValidationErrors(
  params: ArtifactSyncValidationParams,
): string[] {
  const { docsRoot, primaryLibraryId, libraries } = params;

  const errors: string[] = [];

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

export function assertArtifactSyncOutputs(params: ArtifactSyncValidationParams): void {
  const errors = collectArtifactSyncValidationErrors(params);
  if (errors.length === 0) return;

  throw new Error(["Artifact sync validation failed in docs host.", ...errors].join("\n"));
}
