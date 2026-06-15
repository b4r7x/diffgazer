import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { basename, isAbsolute, relative, resolve, win32 } from "node:path";
import { isRelativeSubpath } from "../utils/fs.js";
import { readJson } from "../utils/json.js";
import { assertSafeLibraryId, isPackageName } from "./library-id-validation.js";
import { rewriteSecondaryDemoIndexImports } from "./sync-operations.js";

export interface ArtifactLibrary {
  id: string;
  packageName: string;
  workspaceDir: string;
}

interface ArtifactSourceConfig {
  workspaceDir: string;
  packageName: string;
}

interface DocsLibraryConfig {
  id: string;
  enabled: boolean;
  artifactSource?: ArtifactSourceConfig;
}

export interface DocsLibrariesConfig {
  primaryLibraryId: string;
  libraries: DocsLibraryConfig[];
}

interface ArtifactManifestLike {
  docs?: {
    contentDir?: string;
    metaFile?: string;
    assetsDir?: string;
    generatedDir?: string;
  };
  registry?: {
    publicDir?: string;
    index?: string;
  };
  source?: {
    registryDir?: string;
    stylesDir?: string;
  };
  generated?: Record<string, string>;
}

interface LoadedArtifact {
  id: string;
  artifactRoot: string;
  manifest: ArtifactManifestLike;
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

function toPosixPath(path: string): string {
  return path.split(/[\\/]+/).join("/");
}

function resolveInside(baseDir: string, relPath: unknown, label: string): string {
  if (typeof relPath !== "string" || relPath.length === 0) {
    throw new Error(`${label} must be a non-empty relative path`);
  }
  if (isAbsolute(relPath) || win32.isAbsolute(relPath)) {
    throw new Error(`${label} must be relative: ${relPath}`);
  }

  const baseAbs = resolve(baseDir);
  const target = resolve(baseAbs, relPath);
  const relativePath = relative(baseAbs, target);
  if (relativePath === "" || (!relativePath.startsWith("..") && !isAbsolute(relativePath))) {
    return target;
  }

  throw new Error(`${label} escapes ${baseAbs}: ${relPath}`);
}

function assertRelativeSubpath(path: string, label: string): void {
  if (isRelativeSubpath(path)) return;
  throw new Error(`${label} must be a relative path without '..' segments`);
}

function assertPackageName(name: string, label: string): void {
  if (isPackageName(name)) return;
  throw new Error(`${label} must be an npm package name`);
}

export function parseDocsLibrariesConfig(rawConfig: unknown): DocsLibrariesConfig {
  if (!rawConfig || typeof rawConfig !== "object" || Array.isArray(rawConfig)) {
    throw new Error("docs libraries config must be an object");
  }
  const config = rawConfig as Record<string, unknown>;
  if (typeof config.primaryLibraryId !== "string" || config.primaryLibraryId.length === 0) {
    throw new Error("docs libraries config primaryLibraryId must be a non-empty string");
  }
  assertSafeLibraryId(config.primaryLibraryId, "docs libraries config primaryLibraryId");
  if (!Array.isArray(config.libraries) || config.libraries.length === 0) {
    throw new Error("docs libraries config libraries must be a non-empty array");
  }

  return {
    primaryLibraryId: config.primaryLibraryId,
    libraries: config.libraries.map((rawLibrary, index): DocsLibraryConfig => {
      if (!rawLibrary || typeof rawLibrary !== "object" || Array.isArray(rawLibrary)) {
        throw new Error(`docs libraries config libraries[${index}] must be an object`);
      }
      const library = rawLibrary as Record<string, unknown>;
      if (typeof library.id !== "string" || library.id.length === 0) {
        throw new Error(`docs libraries config libraries[${index}].id must be a non-empty string`);
      }
      assertSafeLibraryId(library.id, `docs libraries config libraries[${index}].id`);
      if (typeof library.enabled !== "boolean") {
        throw new Error(`docs libraries config libraries[${index}].enabled must be a boolean`);
      }

      if (library.artifactSource === undefined) {
        return { id: library.id, enabled: library.enabled };
      }
      if (
        !library.artifactSource ||
        typeof library.artifactSource !== "object" ||
        Array.isArray(library.artifactSource)
      ) {
        throw new Error(
          `docs libraries config libraries[${index}].artifactSource must be an object`,
        );
      }
      const artifactSource = library.artifactSource as Record<string, unknown>;
      if (
        typeof artifactSource.workspaceDir !== "string" ||
        artifactSource.workspaceDir.length === 0
      ) {
        throw new Error(
          `docs libraries config libraries[${index}].artifactSource.workspaceDir must be a non-empty string`,
        );
      }
      assertRelativeSubpath(
        artifactSource.workspaceDir,
        `docs libraries config libraries[${index}].artifactSource.workspaceDir`,
      );
      if (
        typeof artifactSource.packageName !== "string" ||
        artifactSource.packageName.length === 0
      ) {
        throw new Error(
          `docs libraries config libraries[${index}].artifactSource.packageName must be a non-empty string`,
        );
      }
      assertPackageName(
        artifactSource.packageName,
        `docs libraries config libraries[${index}].artifactSource.packageName`,
      );

      return {
        id: library.id,
        enabled: library.enabled,
        artifactSource: {
          workspaceDir: artifactSource.workspaceDir,
          packageName: artifactSource.packageName,
        },
      };
    }),
  };
}

export function readDocsLibrariesConfig(configPath: string): DocsLibrariesConfig {
  return parseDocsLibrariesConfig(readJson(configPath));
}

export function getArtifactLibraries(docsLibraries: DocsLibrariesConfig): ArtifactLibrary[] {
  return docsLibraries.libraries
    .filter((library) => library.enabled && library.artifactSource)
    .map((library) => ({
      id: library.id,
      packageName: (library.artifactSource as ArtifactSourceConfig).packageName,
      workspaceDir: (library.artifactSource as ArtifactSourceConfig).workspaceDir,
    }));
}

function makePackageResolver(resolveFromDir: string): (packageName: string) => boolean {
  const requireFromDir = createRequire(resolve(resolveFromDir, "__docs-artifacts-resolver__.cjs"));

  return (packageName: string) => {
    try {
      requireFromDir.resolve(packageName);
      return true;
    } catch {
      return false;
    }
  };
}

interface ResolveSyncModeOptions {
  libraries?: ArtifactLibrary[];
  resolveFromDir?: string;
  resolvePackage?: (packageName: string) => boolean;
}

export function resolveArtifactSyncMode(
  env: Record<string, string | undefined> = process.env,
  options: ResolveSyncModeOptions = {},
): "workspace" | "package" {
  const override = env.DIFFGAZER_ARTIFACT_SYNC_MODE;
  if (override) {
    if (override === "workspace" || override === "package") return override;
    throw new Error(
      `DIFFGAZER_ARTIFACT_SYNC_MODE must be "workspace" or "package", got "${override}"`,
    );
  }

  if (env.DIFFGAZER_DEV) return "workspace";

  const {
    libraries = [],
    resolveFromDir = process.cwd(),
    resolvePackage = makePackageResolver(resolveFromDir),
  } = options;

  if (libraries.length === 0) return "package";

  const hasUnresolvableArtifactPackage = libraries.some(
    (library) => !resolvePackage(library.packageName),
  );

  return hasUnresolvableArtifactPackage ? "workspace" : "package";
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

    const manifest = readJson(manifestPath) as ArtifactManifestLike;
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

function collectPathParityErrors(
  sourcePath: string,
  artifactPath: string,
  label: string,
  options: ParityOptions = {},
): string[] {
  const errors: string[] = [];
  compareCopiedPath(sourcePath, artifactPath, label, errors, options);
  return errors;
}

function collectTreeParityErrors(
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

export function rewriteDemoIndexForViteGlob(content: string): string {
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
    // biome-ignore lint/suspicious/noTemplateCurlyInString: emitted source text for the generated demo-index module, not an interpolation in this file.
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

  return [
    ...collectTreeParityErrors(
      resolveInside(
        artifact.artifactRoot,
        artifact.manifest.docs?.contentDir,
        `${libraryId} docs content artifact path`,
      ),
      resolve(docsRoot, "content/docs", libraryId),
      `${libraryId} docs content sync`,
    ),
    ...collectTreeParityErrors(
      resolveInside(
        artifact.artifactRoot,
        artifact.manifest.registry?.publicDir,
        `${libraryId} public registry artifact path`,
      ),
      resolve(docsRoot, "public/r", libraryId),
      `${libraryId} public registry sync`,
    ),
  ];
}

function collectAssetOutputErrors(docsRoot: string, artifact: LoadedArtifact): string[] {
  if (!artifact.manifest.docs?.assetsDir) return [];

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

function collectPrimaryGeneratedErrors(docsRoot: string, artifact: LoadedArtifact): string[] {
  if (!artifact.manifest.docs?.generatedDir) return [];

  const artifactGeneratedDir = resolveInside(
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
