import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { log } from "../logger.js";
import { normalizeOrigin } from "../origin.js";
import { collectJsonFiles, ensureExists, resetDir, resolveInside } from "../utils/fs.js";
import { assertSafeLibraryId } from "./library-id-validation.js";
import { assertManifestLibraryId } from "./loader.js";
import type { AfterSyncContext, LoadedLibraryArtifacts, SyncOutputPaths } from "./types.js";

function resolveNamespaceDir(baseDir: string, id: string, label: string): string {
  assertSafeLibraryId(id, label);
  return resolveInside(baseDir, id, label);
}

export function assertArtifactOrigins(
  artifacts: LoadedLibraryArtifacts[],
  requestedOrigin: string,
): void {
  const expectedOrigin = normalizeOrigin(requestedOrigin);

  for (const artifact of artifacts) {
    const artifactOrigin = artifact.manifest.origin;
    if (!artifactOrigin) {
      throw new Error(
        `${artifact.id} artifact manifest is missing origin provenance. Rebuild artifacts for ${expectedOrigin}.`,
      );
    }
    if (artifactOrigin !== expectedOrigin) {
      throw new Error(
        `${artifact.id} artifact origin ${JSON.stringify(artifactOrigin)} does not match requested origin ${JSON.stringify(expectedOrigin)}. Rebuild artifacts for the requested origin.`,
      );
    }
  }
}

function assertNoUnrewrittenOrigin(dir: string, targetOrigin: string, sourceOrigin: string): void {
  if (targetOrigin === sourceOrigin) return;

  const offenders: string[] = [];
  for (const jsonFile of collectJsonFiles(dir)) {
    if (!existsSync(jsonFile)) {
      continue;
    }
    let raw: string;
    try {
      raw = readFileSync(jsonFile, "utf-8");
    } catch (error) {
      throw new Error(`Failed to read registry output for origin check: ${jsonFile}`, {
        cause: error,
      });
    }
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
): void {
  const generatedSourceDirRel = primaryArtifact.manifest.docs.generatedDir;
  const registrySourceDirRel = primaryArtifact.manifest.source?.registryDir;

  if (!generatedSourceDirRel || !registrySourceDirRel) {
    const missing: string[] = [];
    if (!generatedSourceDirRel) missing.push("docs.generatedDir");
    if (!registrySourceDirRel) missing.push("source.registryDir");
    throw new Error(
      `${primaryArtifact.id} manifest missing required primary sync fields: ${missing.join(", ")}`,
    );
  }

  const artGeneratedDir = resolveInside(
    primaryArtifact.artifactRoot,
    generatedSourceDirRel,
    `${primaryArtifact.id} artifact generated data path`,
  );
  const artExamplesDir = resolveInside(
    primaryArtifact.artifactRoot,
    `${registrySourceDirRel}/examples`,
    `${primaryArtifact.id} artifact source examples path`,
  );

  ensureExists(artGeneratedDir, `${primaryArtifact.id} artifact generated data`);
  ensureExists(artExamplesDir, `${primaryArtifact.id} artifact source examples`);

  resetDir(generatedDir);
  resetDir(registryDir);

  const namespacedGenDir = resolveNamespaceDir(
    generatedDir,
    primaryArtifact.id,
    `${primaryArtifact.id} generated namespace output`,
  );
  mkdirSync(namespacedGenDir, { recursive: true });
  cpSync(artGeneratedDir, namespacedGenDir, { recursive: true });

  const outputExamplesDir = resolveInside(registryDir, "examples", "registry examples output");
  mkdirSync(outputExamplesDir, { recursive: true });
  cpSync(artExamplesDir, outputExamplesDir, { recursive: true });
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
    ensureExists(sourcePath, `${artifact.id} generated artifact ${generatedFile}`);
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

export function rewriteSecondaryDemoIndexImports(content: string, libraryId: string): string {
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
  log.info(`[docs-sync] Copied ${artifact.id} examples to registry/examples/${artifact.id}/`);
}

// Precondition: every `artifact.id` (including `primaryArtifact.id`) must already
// be a safe library id. `syncDocsFromArtifacts` validates this at the public
// boundary; each namespaced path resolution here re-checks via `resolveNamespaceDir`.
export function runDocsSyncPass(params: {
  artifacts: LoadedLibraryArtifacts[];
  primaryArtifact: LoadedLibraryArtifacts;
  paths: SyncOutputPaths;
  origin: string;
  sourceOrigin: string;
  afterSync?: (ctx: AfterSyncContext) => void;
}): void {
  const { artifacts, primaryArtifact, paths, origin, sourceOrigin, afterSync } = params;

  assertArtifactOrigins(artifacts, origin);
  for (const artifact of artifacts) {
    assertManifestLibraryId(artifact.id, artifact.manifest);
  }
  assertManifestLibraryId(primaryArtifact.id, primaryArtifact.manifest);

  for (const artifact of artifacts) {
    const docsSource = resolve(artifact.artifactRoot, artifact.manifest.docs.contentDir);
    if (existsSync(docsSource)) {
      resetDir(join(paths.contentDir, artifact.id));
    }
  }
  for (const artifact of artifacts) {
    resetDir(
      resolveNamespaceDir(
        paths.libraryAssetsDir,
        artifact.id,
        `${artifact.id} assets namespace output`,
      ),
    );
  }
  syncPrimaryArtifacts(primaryArtifact, paths.generatedDir, paths.registryDir);

  for (const artifact of artifacts) {
    syncLibraryDocs(artifact, paths.contentDir, paths.generatedDir, paths.libraryAssetsDir, {
      secondaryExampleNamespace: artifact.id === primaryArtifact.id ? undefined : artifact.id,
    });

    copyExamplesForLibrary(artifact, primaryArtifact.id, paths.registryDir);

    afterSync?.({
      libraryId: artifact.id,
      generatedDir: resolveNamespaceDir(
        paths.generatedDir,
        artifact.id,
        `${artifact.id} generated namespace output`,
      ),
    });
  }

  log.info(`[docs-sync] Syncing registries (origin asserted: ${origin})...`);
  syncRegistries(artifacts, paths.publicRegistryDir, origin, sourceOrigin);
}
