import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, relative, resolve } from "node:path";
import type { ArtifactManifest } from "../manifest.js";
import { validateManifest } from "../manifest.js";
import { resolveInside, toPosixPath } from "../utils/fs.js";
import { readJson } from "../utils/json.js";
import type { ArtifactLibrary } from "./docs-libraries-config.js";

export {
  type ArtifactLibrary,
  type DocsLibrariesConfig,
  getArtifactLibraries,
  parseDocsLibrariesConfig,
  readDocsLibrariesConfig,
} from "./docs-libraries-config.js";

import { assertSafeLibraryId } from "./library-id-validation.js";
import {
  rewriteDemoIndexForViteGlob,
  rewriteSecondaryDemoIndexImports,
} from "./sync-operations.js";

export { rewriteDemoIndexForViteGlob } from "./sync-operations.js";

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

interface MissingArtifactFile {
  id: string;
  path: string;
  relativePath: string;
}

interface ParityOptions {
  sourceFilter?: (path: string) => boolean;
  artifactFilter?: (path: string) => boolean;
}

function resolveArtifactPath(baseDir: string, relPath: string, label: string): string {
  try {
    return resolveInside(baseDir, relPath, label);
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.startsWith(`${label} must be a relative path inside`)
    ) {
      throw new Error(`${label} escapes ${resolve(baseDir)}: ${relPath}`, { cause: error });
    }
    throw error;
  }
}

export function collectMissingWorkspaceArtifactFiles(
  workspaceRoot: string,
  libraries: ArtifactLibrary[],
): MissingArtifactFile[] {
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
    const missing: MissingArtifactFile[] = [];

    function addMissing(relPath: string): void {
      const path = resolve(workspaceRoot, relPath);
      if (!existsSync(path)) {
        missing.push({ id: library.id, path, relativePath: relPath });
      }
    }

    addMissing(manifestRelPath);
    addMissing(`${library.workspaceDir}/dist/artifacts/fingerprint.sha256`);

    if (!existsSync(manifestPath)) return missing;

    const manifestResult = validateManifest(readJson(manifestPath));
    if (!manifestResult.success) {
      missing.push({
        id: library.id,
        path: manifestPath,
        relativePath: `${manifestRelPath} (invalid: ${manifestResult.errors.join("; ")})`,
      });
      return missing;
    }

    const manifest = manifestResult.data;
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
    ].filter((relPath): relPath is string => typeof relPath === "string" && relPath.length > 0);

    for (const relPath of expectedArtifactPaths) {
      const artifactPath = resolveArtifactPath(
        artifactRoot,
        relPath,
        `${library.id} artifact path`,
      );
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

function collectFiles(dirPath: string, filter?: (path: string) => boolean): string[] {
  const files: string[] = [];
  const stack = [dirPath];

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current || !existsSync(current)) continue;

    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const entryPath = resolve(current, entry.name);
      if (entry.isDirectory()) {
        if (!filter || filter(entryPath)) stack.push(entryPath);
      } else if (entry.isFile()) {
        if (!filter || filter(entryPath)) files.push(entryPath);
      }
    }
  }

  return files.sort((a, b) => a.localeCompare(b));
}

function filesAreEquivalent(sourcePath: string, artifactPath: string): boolean {
  if (sourcePath.endsWith(".json") && artifactPath.endsWith(".json")) {
    try {
      return JSON.stringify(readJson(sourcePath)) === JSON.stringify(readJson(artifactPath));
    } catch {
      return false;
    }
  }

  const source = readFileSync(sourcePath);
  const artifact = readFileSync(artifactPath);
  return source.equals(artifact);
}

function compareFileTrees(
  sourceDir: string,
  artifactDir: string,
  label: string,
  errors: string[],
  options: ParityOptions = {},
): void {
  if (!existsSync(sourceDir)) {
    errors.push(`${label}: missing source directory ${sourceDir}`);
    return;
  }
  if (!existsSync(artifactDir)) {
    errors.push(`${label}: missing artifact directory ${artifactDir}`);
    return;
  }

  const sourceFiles = collectFiles(sourceDir, options.sourceFilter).map((file) =>
    toPosixPath(relative(sourceDir, file)),
  );
  const artifactFiles = collectFiles(artifactDir, options.artifactFilter).map((file) =>
    toPosixPath(relative(artifactDir, file)),
  );
  const expectedFiles = new Set(sourceFiles);
  const actualFiles = new Set(artifactFiles);
  const allFiles = new Set([...expectedFiles, ...actualFiles]);

  for (const relPath of [...allFiles].sort()) {
    const sourcePath = resolve(sourceDir, relPath);
    const artifactPath = resolve(artifactDir, relPath);
    if (!expectedFiles.has(relPath)) {
      errors.push(`${label}: stale artifact file ${relPath}`);
      continue;
    }
    if (!actualFiles.has(relPath)) {
      errors.push(`${label}: missing artifact file ${relPath}`);
      continue;
    }
    if (filesAreEquivalent(sourcePath, artifactPath)) continue;
    errors.push(`${label}: artifact differs from source for ${relPath}`);
  }
}

function compareCopiedPath(
  sourcePath: string,
  artifactPath: string,
  label: string,
  errors: string[],
  options: ParityOptions = {},
): void {
  if (!existsSync(sourcePath)) {
    errors.push(`${label}: missing source path ${sourcePath}`);
    return;
  }
  if (!existsSync(artifactPath)) {
    errors.push(`${label}: missing artifact path ${artifactPath}`);
    return;
  }

  const sourceStats = statSync(sourcePath);
  const artifactStats = statSync(artifactPath);

  if (sourceStats.isDirectory() && artifactStats.isDirectory()) {
    compareFileTrees(sourcePath, artifactPath, label, errors, options);
    return;
  }

  if (sourceStats.isFile() && artifactStats.isFile()) {
    if (!filesAreEquivalent(sourcePath, artifactPath)) {
      errors.push(`${label}: artifact differs from source`);
    }
    return;
  }

  errors.push(`${label}: source and artifact path types differ`);
}

export function collectPathParityErrors(
  sourcePath: string,
  artifactPath: string,
  label: string,
  options: ParityOptions = {},
): string[] {
  const errors: string[] = [];
  compareCopiedPath(sourcePath, artifactPath, label, errors, options);
  return errors;
}

export function collectTreeParityErrors(
  sourceDir: string,
  artifactDir: string,
  label: string,
  options: ParityOptions = {},
): string[] {
  const errors: string[] = [];
  compareFileTrees(sourceDir, artifactDir, label, errors, options);
  return errors;
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
