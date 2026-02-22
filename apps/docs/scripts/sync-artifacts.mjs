import { createHash } from "node:crypto";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const DOCS_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const WORKSPACE_ROOT = resolve(DOCS_ROOT, "../../..");
const DIFF_UI_ROOT = resolve(WORKSPACE_ROOT, "diff-ui");
const KEYSCOPE_ROOT = resolve(WORKSPACE_ROOT, "keyscope");

const DOCS_CONTENT_DIR = resolve(DOCS_ROOT, "content/docs");
const DOCS_GENERATED_DIR = resolve(DOCS_ROOT, "src/generated");
const DOCS_REGISTRY_DIR = resolve(DOCS_ROOT, "registry");
const DOCS_STYLES_DIR = resolve(DOCS_ROOT, "styles");
const DOCS_PUBLIC_REGISTRY_DIR = resolve(DOCS_ROOT, "public/r");
const DOCS_KEYSCOPE_ASSETS_DIR = resolve(DOCS_ROOT, "public/keyscope-assets");
const DOCS_CACHE_DIR = resolve(DOCS_ROOT, ".cache");
const DOCS_SYNC_STATE_FILE = resolve(DOCS_CACHE_DIR, "sync-artifacts-state.json");

const DEFAULT_REGISTRY_ORIGIN = "https://diffgazer.com";
const KEYSCOPE_SECTION_SEPARATOR = "---Keyscope---";
const KEYSCOPE_SECTION_FOLDER = "...keyscope";

const LIBRARIES = {
  diffui: {
    id: "diff-ui",
    root: DIFF_UI_ROOT,
  },
  keyscope: {
    id: "keyscope",
    root: KEYSCOPE_ROOT,
  },
};

function ensureExists(path, label) {
  if (!existsSync(path)) {
    throw new Error(`${label} not found at "${path}"`);
  }
}

function resetDir(path) {
  rmSync(path, { recursive: true, force: true });
  mkdirSync(path, { recursive: true });
}

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf-8"));
}

function writeJson(filePath, value) {
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function normalizeOrigin(raw) {
  const value = (raw ?? DEFAULT_REGISTRY_ORIGIN).trim();
  if (!/^https?:\/\//.test(value)) {
    throw new Error(`REGISTRY_ORIGIN must start with http:// or https:// (received "${value}")`);
  }
  return value.replace(/\/+$/, "");
}

function collectAllFiles(rootDir, out = []) {
  for (const entry of readdirSync(rootDir)) {
    const fullPath = resolve(rootDir, entry);
    const stats = statSync(fullPath);
    if (stats.isDirectory()) {
      collectAllFiles(fullPath, out);
      continue;
    }
    out.push(fullPath);
  }
  return out;
}

function collectJsonFiles(rootDir, out = []) {
  for (const entry of readdirSync(rootDir)) {
    const fullPath = resolve(rootDir, entry);
    const stats = statSync(fullPath);
    if (stats.isDirectory()) {
      collectJsonFiles(fullPath, out);
      continue;
    }
    if (fullPath.endsWith(".json")) {
      out.push(fullPath);
    }
  }
  return out;
}

function assertNoDefaultOrigin(dir, origin) {
  if (origin === DEFAULT_REGISTRY_ORIGIN) return;

  const offenders = [];
  for (const jsonFile of collectJsonFiles(dir)) {
    const raw = readFileSync(jsonFile, "utf-8");
    if (raw.includes(DEFAULT_REGISTRY_ORIGIN)) {
      offenders.push(jsonFile);
    }
  }

  if (offenders.length > 0) {
    throw new Error(
      [
        `Found unreplaced origin "${DEFAULT_REGISTRY_ORIGIN}" in registry output:`,
        ...offenders,
        "",
        `Rebuild library artifacts with REGISTRY_ORIGIN=${origin}:`,
        `  pnpm --dir ${DIFF_UI_ROOT} build:artifacts`,
        `  pnpm --dir ${KEYSCOPE_ROOT} build:artifacts`,
      ].join("\n"),
    );
  }
}

function relative(base, filePath) {
  return filePath.startsWith(`${base}/`) ? filePath.slice(base.length + 1) : filePath;
}

function computeInputsFingerprint(rootDir, inputs) {
  const hash = createHash("sha256");

  for (const inputRel of inputs) {
    const inputAbs = resolve(rootDir, inputRel);
    if (!existsSync(inputAbs)) continue;
    const stats = statSync(inputAbs);

    if (stats.isDirectory()) {
      const files = collectAllFiles(inputAbs).sort((a, b) => a.localeCompare(b));
      for (const filePath of files) {
        hash.update(relative(rootDir, filePath));
        hash.update("\n");
        hash.update(readFileSync(filePath));
        hash.update("\n");
      }
      continue;
    }

    hash.update(inputRel);
    hash.update("\n");
    hash.update(readFileSync(inputAbs));
    hash.update("\n");
  }

  return hash.digest("hex");
}

function validateManifest(manifestPath, libId) {
  const manifest = readJson(manifestPath);
  if (manifest?.schemaVersion !== 1) {
    throw new Error(`${libId} manifest has unsupported schemaVersion (expected 1): ${manifestPath}`);
  }
  if (!Array.isArray(manifest.inputs) || manifest.inputs.length === 0) {
    throw new Error(`${libId} manifest is missing non-empty "inputs": ${manifestPath}`);
  }
  if (!manifest?.integrity?.fingerprintFile) {
    throw new Error(`${libId} manifest is missing integrity.fingerprintFile: ${manifestPath}`);
  }
  if (!manifest?.docs?.contentDir || !manifest?.docs?.metaFile) {
    throw new Error(`${libId} manifest is missing docs contentDir/metaFile: ${manifestPath}`);
  }
  if (!manifest?.registry?.publicDir || !manifest?.registry?.index) {
    throw new Error(`${libId} manifest is missing registry publicDir/index: ${manifestPath}`);
  }
  return manifest;
}

function loadLibraryArtifacts(library) {
  const manifestPath = resolve(library.root, "dist/artifacts/artifact-manifest.json");
  ensureExists(
    manifestPath,
    `${library.id} artifact manifest`,
  );

  const manifest = validateManifest(manifestPath, library.id);
  const artifactRoot = resolve(library.root, manifest.artifactRoot);
  const fingerprintPath = resolve(artifactRoot, manifest.integrity.fingerprintFile);
  ensureExists(fingerprintPath, `${library.id} artifact fingerprint`);

  const expectedFingerprint = readFileSync(fingerprintPath, "utf-8").trim();
  const currentFingerprint = computeInputsFingerprint(library.root, manifest.inputs);

  if (expectedFingerprint !== currentFingerprint) {
    throw new Error(
      [
        `${library.id} artifacts are stale.`,
        `Expected fingerprint: ${expectedFingerprint}`,
        `Current fingerprint:  ${currentFingerprint}`,
        `Run: pnpm --dir ${library.root} build:artifacts`,
      ].join("\n"),
    );
  }

  return {
    ...library,
    manifest,
    manifestPath,
    artifactRoot,
    fingerprintPath,
    fingerprint: expectedFingerprint,
  };
}

function docsOutputsExist() {
  const required = [
    resolve(DOCS_CONTENT_DIR, "meta.json"),
    resolve(DOCS_GENERATED_DIR, "component-list.json"),
    resolve(DOCS_GENERATED_DIR, "diffui-hooks.json"),
    resolve(DOCS_GENERATED_DIR, "keyscope-hooks.json"),
    resolve(DOCS_REGISTRY_DIR, "registry.json"),
    resolve(DOCS_STYLES_DIR, "styles.css"),
    resolve(DOCS_PUBLIC_REGISTRY_DIR, "diff-ui/registry.json"),
    resolve(DOCS_PUBLIC_REGISTRY_DIR, "keyscope/registry.json"),
  ];
  return required.every((filePath) => existsSync(filePath));
}

function computeSyncFingerprint(origin, diffuiArtifacts, keyscopeArtifacts) {
  const hash = createHash("sha256");
  hash.update(`origin:${origin}\n`);

  for (const artifact of [diffuiArtifacts, keyscopeArtifacts]) {
    hash.update(`${artifact.id}:manifest:${artifact.manifestPath}\n`);
    hash.update(readFileSync(artifact.manifestPath, "utf-8"));
    hash.update("\n");
    hash.update(`${artifact.id}:fingerprint:${artifact.fingerprintPath}\n`);
    hash.update(artifact.fingerprint);
    hash.update("\n");
  }

  return hash.digest("hex");
}

function readSyncState() {
  if (!existsSync(DOCS_SYNC_STATE_FILE)) return null;
  try {
    return JSON.parse(readFileSync(DOCS_SYNC_STATE_FILE, "utf-8"));
  } catch {
    return null;
  }
}

function writeSyncState(state) {
  mkdirSync(DOCS_CACHE_DIR, { recursive: true });
  writeFileSync(DOCS_SYNC_STATE_FILE, `${JSON.stringify(state, null, 2)}\n`);
}

function syncDiffUiArtifacts(diffuiArtifacts) {
  const docsDir = resolve(diffuiArtifacts.artifactRoot, diffuiArtifacts.manifest.docs.contentDir);
  const generatedDir = resolve(diffuiArtifacts.artifactRoot, diffuiArtifacts.manifest.docs.generatedDir);
  const sourceRegistryDir = resolve(
    diffuiArtifacts.artifactRoot,
    diffuiArtifacts.manifest.source.registryDir,
  );
  const sourceStylesDir = resolve(
    diffuiArtifacts.artifactRoot,
    diffuiArtifacts.manifest.source.stylesDir,
  );

  ensureExists(docsDir, "diff-ui artifact docs");
  ensureExists(generatedDir, "diff-ui artifact generated data");
  ensureExists(sourceRegistryDir, "diff-ui artifact source registry");
  ensureExists(sourceStylesDir, "diff-ui artifact source styles");

  resetDir(DOCS_CONTENT_DIR);
  resetDir(DOCS_GENERATED_DIR);
  resetDir(DOCS_REGISTRY_DIR);
  resetDir(DOCS_STYLES_DIR);

  cpSync(docsDir, DOCS_CONTENT_DIR, { recursive: true });
  cpSync(generatedDir, DOCS_GENERATED_DIR, { recursive: true });
  cpSync(sourceRegistryDir, DOCS_REGISTRY_DIR, { recursive: true });
  cpSync(sourceStylesDir, DOCS_STYLES_DIR, { recursive: true });

  const demoIndexPath = resolve(DOCS_GENERATED_DIR, "demo-index.ts");
  if (existsSync(demoIndexPath)) {
    const raw = readFileSync(demoIndexPath, "utf-8");
    const rewritten = raw.replaceAll(
      "../../../../registry/examples/",
      "../../registry/examples/",
    );
    if (rewritten !== raw) {
      writeFileSync(demoIndexPath, rewritten);
    }
  }
}

function syncKeyscopeArtifacts(keyscopeArtifacts) {
  const docsDir = resolve(keyscopeArtifacts.artifactRoot, keyscopeArtifacts.manifest.docs.contentDir);
  ensureExists(docsDir, "keyscope artifact docs");

  const keyscopeOutputDir = resolve(DOCS_CONTENT_DIR, "keyscope");
  resetDir(keyscopeOutputDir);
  cpSync(docsDir, keyscopeOutputDir, { recursive: true, force: true });

  const keyscopeHooksFile = resolve(
    keyscopeArtifacts.artifactRoot,
    keyscopeArtifacts.manifest.generated.keyscopeHooksFile,
  );
  ensureExists(keyscopeHooksFile, "keyscope hooks generated artifact");
  cpSync(keyscopeHooksFile, resolve(DOCS_GENERATED_DIR, "keyscope-hooks.json"), { force: true });

  const rootMetaPath = resolve(DOCS_CONTENT_DIR, "meta.json");
  const rootMeta = readJson(rootMetaPath);
  const pagesWithoutKeyscope = (rootMeta.pages ?? []).filter(
    (entry) => entry !== KEYSCOPE_SECTION_SEPARATOR && entry !== KEYSCOPE_SECTION_FOLDER,
  );
  rootMeta.pages = [...pagesWithoutKeyscope, KEYSCOPE_SECTION_SEPARATOR, KEYSCOPE_SECTION_FOLDER];
  writeJson(rootMetaPath, rootMeta);

  if (keyscopeArtifacts.manifest.docs.assetsDir) {
    const assetsDir = resolve(keyscopeArtifacts.artifactRoot, keyscopeArtifacts.manifest.docs.assetsDir);
    resetDir(DOCS_KEYSCOPE_ASSETS_DIR);
    if (existsSync(assetsDir)) {
      cpSync(assetsDir, DOCS_KEYSCOPE_ASSETS_DIR, { recursive: true, force: true });
    }
  }
}

function syncRegistries(diffuiArtifacts, keyscopeArtifacts, origin) {
  const diffRegistryDir = resolve(
    diffuiArtifacts.artifactRoot,
    diffuiArtifacts.manifest.registry.publicDir,
  );
  const keyscopeRegistryDir = resolve(
    keyscopeArtifacts.artifactRoot,
    keyscopeArtifacts.manifest.registry.publicDir,
  );
  ensureExists(diffRegistryDir, "diff-ui artifact public registry");
  ensureExists(keyscopeRegistryDir, "keyscope artifact public registry");

  const diffOutput = resolve(DOCS_PUBLIC_REGISTRY_DIR, "diff-ui");
  const keyscopeOutput = resolve(DOCS_PUBLIC_REGISTRY_DIR, "keyscope");
  resetDir(DOCS_PUBLIC_REGISTRY_DIR);
  resetDir(diffOutput);
  resetDir(keyscopeOutput);

  cpSync(diffRegistryDir, diffOutput, { recursive: true, force: true });
  cpSync(keyscopeRegistryDir, keyscopeOutput, { recursive: true, force: true });

  assertNoDefaultOrigin(DOCS_PUBLIC_REGISTRY_DIR, origin);
}

function main() {
  const origin = normalizeOrigin(process.env.REGISTRY_ORIGIN);
  const diffuiArtifacts = loadLibraryArtifacts(LIBRARIES.diffui);
  const keyscopeArtifacts = loadLibraryArtifacts(LIBRARIES.keyscope);
  const syncFingerprint = computeSyncFingerprint(origin, diffuiArtifacts, keyscopeArtifacts);
  const syncState = readSyncState();

  if (syncState?.fingerprint === syncFingerprint && docsOutputsExist()) {
    console.log("[docs-sync] Artifacts unchanged; skipping sync.");
    return;
  }

  console.log("[docs-sync] Syncing diff-ui artifacts...");
  syncDiffUiArtifacts(diffuiArtifacts);

  console.log("[docs-sync] Syncing keyscope artifacts...");
  syncKeyscopeArtifacts(keyscopeArtifacts);

  console.log(`[docs-sync] Syncing registries (origin asserted: ${origin})...`);
  syncRegistries(diffuiArtifacts, keyscopeArtifacts, origin);

  writeSyncState({
    fingerprint: syncFingerprint,
    origin,
    syncedAt: new Date().toISOString(),
  });

  console.log("[docs-sync] Done.");
}

main();
