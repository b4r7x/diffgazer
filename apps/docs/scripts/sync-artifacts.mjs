import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import {
  assertArtifactSyncOutputs,
  getArtifactLibraries,
  normalizeOrigin,
  REGISTRY_ORIGIN,
  readDocsLibrariesConfig,
  rewriteDemoIndexForViteGlob,
  syncDocsFromArtifacts,
} from "@diffgazer/registry";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const DOCS_ROOT = resolve(dirname(SCRIPT_PATH), "..");
const WORKSPACE_ROOT = resolve(DOCS_ROOT, "../..");
const DOCS_LIBRARIES_CONFIG_PATH = resolve(DOCS_ROOT, "config/docs-libraries.json");
const SOURCE_ARCHIVE_SUFFIX = ".source.json";
const SOURCE_DATA_KINDS = ["components", "hooks"];
const SAFE_PATH_SEGMENT = /^[a-z0-9-]+$/;

function assertSafePathSegment(value, label) {
  if (!SAFE_PATH_SEGMENT.test(value)) {
    throw new Error(`${label} must contain only lowercase letters, digits, and hyphens: ${value}`);
  }
}

function resolveInside(baseDir, relPath, label) {
  const root = resolve(baseDir);
  const target = resolve(root, relPath);
  if (target !== root && !target.startsWith(`${root}${sep}`)) {
    throw new Error(`${label} escapes ${root}: ${relPath}`);
  }
  return target;
}

function sourceArchivesIn(dir) {
  if (!existsSync(dir)) return [];

  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.name.endsWith(SOURCE_ARCHIVE_SUFFIX))
    .map((entry) => {
      if (!entry.isFile()) {
        throw new Error(`Source archive must be a regular file: ${resolve(dir, entry.name)}`);
      }
      const name = entry.name.slice(0, -SOURCE_ARCHIVE_SUFFIX.length);
      assertSafePathSegment(name, "Source archive name");
      return { name, path: resolve(dir, entry.name) };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

function collectFiles(dir) {
  if (!existsSync(dir)) return [];

  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(dir, entry.name);
    return entry.isDirectory() ? collectFiles(path) : [path];
  });
}

function filesMatch(left, right) {
  if (!existsSync(right) || statSync(left).size !== statSync(right).size) return false;
  return readFileSync(left).equals(readFileSync(right));
}

function syncPublicSourceArchive(sourcePath, targetPath) {
  mkdirSync(dirname(targetPath), { recursive: true });
  if (filesMatch(sourcePath, targetPath)) return;

  copyFileSync(sourcePath, targetPath);
  rmSync(`${targetPath}.gz`, { force: true });
  rmSync(`${targetPath}.br`, { force: true });
}

function removeEmptyDirectories(dir, keepRoot = true) {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) removeEmptyDirectories(resolve(dir, entry.name), false);
  }
  if (!keepRoot && readdirSync(dir).length === 0) rmSync(dir, { recursive: true });
}

function removeGeneratedSourceData(docsRoot) {
  const generatedRoot = resolve(docsRoot, "src/generated");
  for (const path of collectFiles(generatedRoot)) {
    if (path.endsWith(SOURCE_ARCHIVE_SUFFIX)) rmSync(path, { force: true });
  }
}

function stageSourceData({ docsRoot, artifactLibraries, artifacts }) {
  const publicRoot = resolve(docsRoot, "public/source-data");
  const generatedRoot = resolve(docsRoot, "src/generated");
  const configuredLibraries = new Set(artifactLibraries.map((library) => library.id));
  const expectedPublicFiles = new Set();

  mkdirSync(publicRoot, { recursive: true });

  try {
    for (const artifact of artifacts) {
      if (!configuredLibraries.has(artifact.id)) {
        throw new Error(`Unexpected source-data artifact library: ${artifact.id}`);
      }
      assertSafePathSegment(artifact.id, "Source-data library id");

      const artifactGeneratedRoot = resolveInside(
        artifact.artifactRoot,
        artifact.manifest.docs.generatedDir,
        `${artifact.id} generated artifact path`,
      );
      const handledArtifactSources = new Set();

      for (const kind of SOURCE_DATA_KINDS) {
        const artifactKindDir = resolveInside(
          artifactGeneratedRoot,
          kind,
          `${artifact.id} ${kind} source-data path`,
        );

        for (const archive of sourceArchivesIn(artifactKindDir)) {
          const relativeArchivePath = `${artifact.id}/${kind}/${archive.name}${SOURCE_ARCHIVE_SUFFIX}`;
          const publicPath = resolveInside(
            publicRoot,
            relativeArchivePath,
            `${artifact.id} public source-data output`,
          );
          const generatedPath = resolveInside(
            generatedRoot,
            relativeArchivePath,
            `${artifact.id} generated source-data output`,
          );

          syncPublicSourceArchive(archive.path, publicPath);
          handledArtifactSources.add(archive.path);
          expectedPublicFiles.add(publicPath);
          expectedPublicFiles.add(`${publicPath}.gz`);
          expectedPublicFiles.add(`${publicPath}.br`);

          // A cached artifact sync no longer has source archives in src/generated.
          // Restore them only long enough for the existing artifact parity assertion.
          if (!existsSync(generatedPath)) {
            mkdirSync(dirname(generatedPath), { recursive: true });
            copyFileSync(archive.path, generatedPath);
          }
        }
      }

      const unexpectedArtifactSources = collectFiles(artifactGeneratedRoot).filter(
        (path) => path.endsWith(SOURCE_ARCHIVE_SUFFIX) && !handledArtifactSources.has(path),
      );
      if (unexpectedArtifactSources.length > 0) {
        throw new Error(
          `Source archives must live directly under components/ or hooks/:\n${unexpectedArtifactSources.join("\n")}`,
        );
      }
    }

    for (const file of collectFiles(publicRoot)) {
      if (!expectedPublicFiles.has(file)) rmSync(file, { force: true });
    }
    removeEmptyDirectories(publicRoot);
  } catch (error) {
    removeGeneratedSourceData(docsRoot);
    throw error;
  }
}

export function syncArtifacts(options = {}) {
  const docsRoot = options.docsRoot ?? DOCS_ROOT;
  const workspaceRoot = options.workspaceRoot ?? WORKSPACE_ROOT;
  const configPath = options.configPath ?? DOCS_LIBRARIES_CONFIG_PATH;
  const env = options.env ?? process.env;
  const docsLibraries = readDocsLibrariesConfig(configPath);
  const artifactLibraries = getArtifactLibraries(docsLibraries);

  const syncResult = syncDocsFromArtifacts({
    docsRoot,
    workspaceRoot,
    libraries: artifactLibraries,
    primaryLibraryId: docsLibraries.primaryLibraryId,
    origin: normalizeOrigin(env.REGISTRY_ORIGIN, {
      defaultOrigin: REGISTRY_ORIGIN,
    }),
    sourceOrigin: REGISTRY_ORIGIN,
  });

  const rootMetaContent = `${JSON.stringify(
    {
      title: "Documentation",
      root: true,
      pages: docsLibraries.libraries
        .filter((library) => library.enabled)
        .map((library) => `...${library.id}`),
    },
    null,
    2,
  )}\n`;

  writeFileSync(join(docsRoot, "content/docs/meta.json"), rootMetaContent);

  const demoEntries = artifactLibraries
    .filter((lib) => existsSync(join(docsRoot, "src/generated", lib.id, "demo-index.ts")))
    .map((lib) => `  "${lib.id}": () => import("./${lib.id}/demo-index"),`);

  const demoLoadersContent = [
    "// Auto-generated by prepare:generated. Do not edit.",
    `import type { ComponentType, LazyExoticComponent } from "react"`,
    `export type DemoMap = Record<string, LazyExoticComponent<ComponentType>>`,
    `export const demoLoaders: Record<string, () => Promise<{ demos: DemoMap }>> = {`,
    ...demoEntries,
    `}`,
    "",
  ].join("\n");

  writeFileSync(join(docsRoot, "src/generated/demo-loaders.ts"), demoLoadersContent);

  const libraryDataImports = [];
  const hooksDataEntries = [];

  for (const lib of artifactLibraries) {
    const genDir = join(docsRoot, "src/generated", lib.id);
    if (!existsSync(genDir)) continue;

    const files = readdirSync(genDir).filter((f) => f.endsWith(".json"));

    for (const file of files) {
      if (!file.endsWith("-hooks.json")) continue;

      const varName = `${lib.id.replace(/-/g, "_")}_${file.replace(/-/g, "_").replace(".json", "")}`;
      libraryDataImports.push(`import ${varName} from "./${lib.id}/${file}"`);
      hooksDataEntries.push(`  "${lib.id}": ${varName},`);
    }
  }

  const libraryDataContent = [
    "// Auto-generated by prepare:generated. Do not edit.",
    ...libraryDataImports,
    "",
    `export const hooksData: Record<string, Record<string, unknown>> = {`,
    ...hooksDataEntries,
    `}`,
    "",
  ].join("\n");

  writeFileSync(join(docsRoot, "src/generated/library-data.ts"), libraryDataContent);

  for (const lib of artifactLibraries) {
    const demoIndexPath = join(docsRoot, "src/generated", lib.id, "demo-index.ts");
    if (!existsSync(demoIndexPath)) continue;

    writeFileSync(demoIndexPath, rewriteDemoIndexForViteGlob(readFileSync(demoIndexPath, "utf-8")));
  }

  stageSourceData({
    docsRoot,
    artifactLibraries,
    artifacts: syncResult.artifacts,
  });
  try {
    assertArtifactSyncOutputs({
      docsRoot,
      primaryLibraryId: docsLibraries.primaryLibraryId,
      libraries: artifactLibraries,
      artifacts: syncResult.artifacts,
    });
  } finally {
    removeGeneratedSourceData(docsRoot);
  }

  return { docsLibraries, artifactLibraries, syncResult };
}

if (process.argv[1] === SCRIPT_PATH) {
  syncArtifacts();
}
