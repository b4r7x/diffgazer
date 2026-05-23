import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { basename, join, resolve } from "node:path";
import { ensureExists, resetDir, collectJsonFiles, resolveInside } from "../utils/fs.js";
import { writeJson } from "../utils/json.js";
import { defaultLogger, type Logger } from "../logger.js";
import type { LoadedLibraryArtifacts, AfterSyncContext, SyncOutputPaths } from "./types.js";

const SAFE_LIBRARY_ID_RE = /^[a-z0-9][a-z0-9-]*$/i;

function assertSafeLibraryId(id: string, label: string): void {
  if (SAFE_LIBRARY_ID_RE.test(id)) return;
  throw new Error(`${label} must be a safe library id`);
}

function resolveNamespaceDir(baseDir: string, id: string, label: string): string {
  assertSafeLibraryId(id, label);
  return resolveInside(baseDir, id, label);
}

function assertNoUnrewrittenOrigin(dir: string, targetOrigin: string, sourceOrigin: string): void {
  if (targetOrigin === sourceOrigin) return;

  const offenders: string[] = [];
  for (const jsonFile of collectJsonFiles(dir)) {
    const raw = readFileSync(jsonFile, "utf-8");
    if (raw.includes(sourceOrigin)) {
      offenders.push(jsonFile);
    }
  }

  if (offenders.length > 0) {
    throw new Error(
      [
        `Found unreplaced origin "${sourceOrigin}" in registry output:`,
        ...offenders,
        "",
        "Rebuild library artifacts with correct REGISTRY_ORIGIN.",
      ].join("\n"),
    );
  }
}

function syncPrimaryArtifacts(
  primaryArtifact: LoadedLibraryArtifacts,
  generatedDir: string,
  registryDir: string,
  stylesDir: string,
): void {
  const generatedSourceDirRel = primaryArtifact.manifest.docs.generatedDir;
  const registrySourceDirRel = primaryArtifact.manifest.source?.registryDir;
  const stylesSourceDirRel = primaryArtifact.manifest.source?.stylesDir;

  if (!generatedSourceDirRel || !registrySourceDirRel || !stylesSourceDirRel) {
    const missing: string[] = [];
    if (!generatedSourceDirRel) missing.push("docs.generatedDir");
    if (!registrySourceDirRel) missing.push("source.registryDir");
    if (!stylesSourceDirRel) missing.push("source.stylesDir");
    throw new Error(
      `${primaryArtifact.id} manifest missing required primary sync fields: ${missing.join(", ")}`,
    );
  }

  const artGeneratedDir = resolveInside(
    primaryArtifact.artifactRoot,
    generatedSourceDirRel,
    `${primaryArtifact.id} artifact generated data path`,
  );
  const artRegistryDir = resolveInside(
    primaryArtifact.artifactRoot,
    registrySourceDirRel,
    `${primaryArtifact.id} artifact source registry path`,
  );
  const artStylesDir = resolveInside(
    primaryArtifact.artifactRoot,
    stylesSourceDirRel,
    `${primaryArtifact.id} artifact source styles path`,
  );

  ensureExists(artGeneratedDir, `${primaryArtifact.id} artifact generated data`);
  ensureExists(artRegistryDir, `${primaryArtifact.id} artifact source registry`);
  ensureExists(artStylesDir, `${primaryArtifact.id} artifact source styles`);

  resetDir(generatedDir);
  resetDir(registryDir);
  resetDir(stylesDir);

  const namespacedGenDir = resolveNamespaceDir(
    generatedDir,
    primaryArtifact.id,
    `${primaryArtifact.id} generated namespace output`,
  );
  mkdirSync(namespacedGenDir, { recursive: true });
  cpSync(artGeneratedDir, namespacedGenDir, { recursive: true });
  cpSync(artRegistryDir, registryDir, { recursive: true });
  cpSync(artStylesDir, stylesDir, { recursive: true });
}

function syncLibraryDocs(
  artifact: LoadedLibraryArtifacts,
  contentDir: string,
  generatedDir: string,
  libraryAssetsDir: string,
  options: { secondaryExampleNamespace?: string } = {},
): void {
  const docsDir = resolveInside(
    artifact.artifactRoot,
    artifact.manifest.docs.contentDir,
    `${artifact.id} artifact docs path`,
  );
  ensureExists(docsDir, `${artifact.id} artifact docs`);
  ensureExists(resolve(docsDir, "meta.json"), `${artifact.id} docs meta`);

  const outputDir = resolveNamespaceDir(
    contentDir,
    artifact.id,
    `${artifact.id} docs namespace output`,
  );
  resetDir(outputDir);
  cpSync(docsDir, outputDir, { recursive: true, force: true });

  for (const generatedFile of artifact.generatedFiles) {
    const sourcePath = resolveInside(
      artifact.artifactRoot,
      generatedFile,
      `${artifact.id} generated artifact path ${generatedFile}`,
    );
    ensureExists(
      sourcePath,
      `${artifact.id} generated artifact ${generatedFile}`,
    );
    const targetDir = resolveNamespaceDir(
      generatedDir,
      artifact.id,
      `${artifact.id} generated namespace output`,
    );
    const targetPath = resolve(targetDir, basename(generatedFile));
    mkdirSync(targetDir, { recursive: true });

    if (basename(generatedFile) === "demo-index.ts" && options.secondaryExampleNamespace) {
      writeFileSync(
        targetPath,
        rewriteSecondaryDemoIndexImports(
          readFileSync(sourcePath, "utf-8"),
          options.secondaryExampleNamespace,
        ),
      );
      continue;
    }

    cpSync(sourcePath, targetPath, {
      recursive: true,
      force: true,
    });
  }

  if (!artifact.manifest.docs.assetsDir) return;
  const assetsDir = resolveInside(
    artifact.artifactRoot,
    artifact.manifest.docs.assetsDir,
    `${artifact.id} artifact assets path`,
  );
  if (!existsSync(assetsDir)) return;
  const targetAssetsDir = resolveNamespaceDir(
    libraryAssetsDir,
    artifact.id,
    `${artifact.id} assets namespace output`,
  );
  resetDir(targetAssetsDir);
  cpSync(assetsDir, targetAssetsDir, { recursive: true, force: true });
}

function rewriteSecondaryDemoIndexImports(content: string, libraryId: string): string {
  return content.replace(
    /import\("([^"]*?registry\/examples\/)([^"]+)"\)/g,
    (_match, _prefix, examplePath: string) => {
      const namespacedExamplePath = examplePath.startsWith(`${libraryId}/`)
        ? examplePath
        : `${libraryId}/${examplePath}`;
      return `import("../../../registry/examples/${namespacedExamplePath}")`;
    },
  );
}

function writeRootMeta(
  artifacts: LoadedLibraryArtifacts[],
  contentDir: string,
  title = "Documentation",
): void {
  const pages = artifacts.map((artifact) => `...${artifact.id}`);
  writeJson(resolve(contentDir, "meta.json"), {
    title,
    root: true,
    pages,
  });
}

function syncRegistries(
  artifacts: LoadedLibraryArtifacts[],
  publicRegistryDir: string,
  origin: string,
  sourceOrigin: string,
): void {
  resetDir(publicRegistryDir);

  for (const artifact of artifacts) {
    const sourceDir = resolveInside(
      artifact.artifactRoot,
      artifact.manifest.registry.publicDir,
      `${artifact.id} artifact public registry path`,
    );
    ensureExists(sourceDir, `${artifact.id} artifact public registry`);

    const outputDir = resolveNamespaceDir(
      publicRegistryDir,
      artifact.id,
      `${artifact.id} public registry namespace output`,
    );
    resetDir(outputDir);
    cpSync(sourceDir, outputDir, { recursive: true, force: true });
  }

  assertNoUnrewrittenOrigin(publicRegistryDir, origin, sourceOrigin);
}

function copyExamplesForLibrary(
  artifact: LoadedLibraryArtifacts,
  primaryId: string,
  registryDir: string,
  logger: Logger,
): void {
  if (artifact.id === primaryId) return;
  if (!artifact.manifest.source?.registryDir) return;

  const artExamplesDir = resolve(
    resolveInside(
      artifact.artifactRoot,
      artifact.manifest.source.registryDir,
      `${artifact.id} artifact source registry path`,
    ),
    "examples",
  );
  if (!existsSync(artExamplesDir)) return;

  const examplesDir = resolveInside(registryDir, "examples", "registry examples output");
  const targetExamplesDir = resolveNamespaceDir(
    examplesDir,
    artifact.id,
    `${artifact.id} registry examples namespace output`,
  );
  mkdirSync(targetExamplesDir, { recursive: true });
  cpSync(artExamplesDir, targetExamplesDir, { recursive: true });
  logger.info(
    `[docs-sync] Copied ${artifact.id} examples to registry/examples/${artifact.id}/`,
  );
}

export function runDocsSyncPass(params: {
  artifacts: LoadedLibraryArtifacts[];
  primaryArtifact: LoadedLibraryArtifacts;
  paths: SyncOutputPaths;
  origin: string;
  sourceOrigin: string;
  afterSync?: (ctx: AfterSyncContext) => void;
  rootTitle?: string;
  logger?: Logger;
}): void {
  const {
    artifacts,
    primaryArtifact,
    paths,
    origin,
    sourceOrigin,
    afterSync,
    rootTitle,
    logger = defaultLogger,
  } = params;

  assertSafeLibraryId(primaryArtifact.id, "Primary library id");
  for (const artifact of artifacts) {
    assertSafeLibraryId(artifact.id, `Library id "${artifact.id}"`);
  }

  for (const artifact of artifacts) {
    resetDir(join(paths.contentDir, artifact.id));
  }
  for (const artifact of artifacts) {
    resetDir(join(paths.libraryAssetsDir, artifact.id));
  }
  syncPrimaryArtifacts(
    primaryArtifact,
    paths.generatedDir,
    paths.registryDir,
    paths.stylesDir,
  );

  for (const artifact of artifacts) {
    syncLibraryDocs(
      artifact,
      paths.contentDir,
      paths.generatedDir,
      paths.libraryAssetsDir,
      {
        secondaryExampleNamespace: artifact.id === primaryArtifact.id
          ? undefined
          : artifact.id,
      },
    );

    copyExamplesForLibrary(artifact, primaryArtifact.id, paths.registryDir, logger);

    afterSync?.({
      libraryId: artifact.id,
      generatedDir: resolveNamespaceDir(
        paths.generatedDir,
        artifact.id,
        `${artifact.id} generated namespace output`,
      ),
    });
  }

  writeRootMeta(artifacts, paths.contentDir, rootTitle);

  logger.info(
    `[docs-sync] Syncing registries (origin asserted: ${origin})...`,
  );
  syncRegistries(artifacts, paths.publicRegistryDir, origin, sourceOrigin);
}
