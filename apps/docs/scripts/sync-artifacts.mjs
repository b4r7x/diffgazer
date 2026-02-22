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
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const DOCS_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const WORKSPACE_ROOT = resolve(DOCS_ROOT, "../../..");
const DIFF_UI_ROOT = resolve(WORKSPACE_ROOT, "diff-ui");
const KEYSCOPE_ROOT = resolve(WORKSPACE_ROOT, "keyscope");

const DIFF_UI_MANIFEST_PATH = resolve(DIFF_UI_ROOT, "internal-docs-manifest.json");
const KEYSCOPE_MANIFEST_PATH = resolve(KEYSCOPE_ROOT, "internal-docs-manifest.json");

const DOCS_CONTENT_DIR = resolve(DOCS_ROOT, "content/docs");
const DOCS_GENERATED_DIR = resolve(DOCS_ROOT, "src/generated");
const DOCS_REGISTRY_DIR = resolve(DOCS_ROOT, "registry");
const DOCS_STYLES_DIR = resolve(DOCS_ROOT, "styles");
const DOCS_PUBLIC_REGISTRY_DIR = resolve(DOCS_ROOT, "public/r");

const DEFAULT_REGISTRY_ORIGIN = "https://diffui.dev";
const KEYSCOPE_SECTION_SEPARATOR = "---Keyscope---";
const KEYSCOPE_SECTION_FOLDER = "...keyscope";

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf-8"));
}

function writeJson(filePath, value) {
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function ensureExists(path, label) {
  if (!existsSync(path)) {
    throw new Error(`${label} not found at "${path}"`);
  }
}

function resetDir(path) {
  rmSync(path, { recursive: true, force: true });
  mkdirSync(path, { recursive: true });
}

function normalizeOrigin(raw) {
  const value = (raw ?? DEFAULT_REGISTRY_ORIGIN).trim();
  if (!/^https?:\/\//.test(value)) {
    throw new Error(`REGISTRY_ORIGIN must start with http:// or https:// (received "${value}")`);
  }
  return value.replace(/\/+$/, "");
}

function rewriteOrigin(value, origin) {
  if (typeof value === "string") {
    return value.replaceAll(DEFAULT_REGISTRY_ORIGIN, origin);
  }
  if (Array.isArray(value)) {
    return value.map((item) => rewriteOrigin(item, origin));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, rewriteOrigin(v, origin)]),
    );
  }
  return value;
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

function run(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, stdio: "inherit" });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed with exit code ${result.status}`);
  }
}

function syncDiffUiArtifacts(diffManifest) {
  const diffContentDir = resolve(DIFF_UI_ROOT, diffManifest.docs.contentDir);
  const diffGeneratedDir = resolve(DIFF_UI_ROOT, diffManifest.docs.generatedDir);
  const diffRegistryDir = resolve(DIFF_UI_ROOT, diffManifest.registry.sourceDir);
  const diffStylesDir = resolve(DIFF_UI_ROOT, diffManifest.registry.stylesDir);

  ensureExists(diffContentDir, "diff-ui docs content");
  ensureExists(diffGeneratedDir, "diff-ui docs generated");
  ensureExists(diffRegistryDir, "diff-ui registry source");
  ensureExists(diffStylesDir, "diff-ui styles");

  resetDir(DOCS_CONTENT_DIR);
  resetDir(DOCS_GENERATED_DIR);
  resetDir(DOCS_REGISTRY_DIR);
  resetDir(DOCS_STYLES_DIR);

  cpSync(diffContentDir, DOCS_CONTENT_DIR, { recursive: true });
  cpSync(diffGeneratedDir, DOCS_GENERATED_DIR, { recursive: true });
  cpSync(diffRegistryDir, DOCS_REGISTRY_DIR, { recursive: true });
  cpSync(diffStylesDir, DOCS_STYLES_DIR, { recursive: true });

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

function syncKeyscopeDocs(keyscopeManifest) {
  const keyscopeContentDir = resolve(KEYSCOPE_ROOT, keyscopeManifest.docs.contentDir);
  ensureExists(keyscopeContentDir, "keyscope docs content");

  const keyscopeOutputDir = resolve(DOCS_CONTENT_DIR, "keyscope");
  resetDir(keyscopeOutputDir);
  cpSync(keyscopeContentDir, keyscopeOutputDir, { recursive: true, force: true });

  const rootMetaPath = resolve(DOCS_CONTENT_DIR, "meta.json");
  const rootMeta = readJson(rootMetaPath);
  const pagesWithoutKeyscope = (rootMeta.pages ?? []).filter(
    (entry) => entry !== KEYSCOPE_SECTION_SEPARATOR && entry !== KEYSCOPE_SECTION_FOLDER,
  );
  rootMeta.pages = [...pagesWithoutKeyscope, KEYSCOPE_SECTION_SEPARATOR, KEYSCOPE_SECTION_FOLDER];
  writeJson(rootMetaPath, rootMeta);
}

function syncRegistries(diffManifest, keyscopeManifest, origin) {
  const diffPublicRegistryDir = resolve(DIFF_UI_ROOT, diffManifest.registry.publicDir);
  const keyscopePublicRegistryDir = resolve(KEYSCOPE_ROOT, keyscopeManifest.registry.publicDir);

  ensureExists(diffPublicRegistryDir, "diff-ui public registry");
  ensureExists(keyscopePublicRegistryDir, "keyscope public registry");

  const diffOutput = resolve(DOCS_PUBLIC_REGISTRY_DIR, "diff-ui");
  const keyscopeOutput = resolve(DOCS_PUBLIC_REGISTRY_DIR, "keyscope");

  resetDir(DOCS_PUBLIC_REGISTRY_DIR);
  resetDir(diffOutput);
  resetDir(keyscopeOutput);

  for (const entry of readdirSync(diffPublicRegistryDir, { withFileTypes: true })) {
    if (entry.name === "keyscope") continue;
    cpSync(
      resolve(diffPublicRegistryDir, entry.name),
      resolve(diffOutput, entry.name),
      { recursive: true, force: true },
    );
  }

  for (const entry of readdirSync(keyscopePublicRegistryDir, { withFileTypes: true })) {
    cpSync(
      resolve(keyscopePublicRegistryDir, entry.name),
      resolve(keyscopeOutput, entry.name),
      { recursive: true, force: true },
    );
  }

  for (const jsonFile of collectJsonFiles(DOCS_PUBLIC_REGISTRY_DIR)) {
    const raw = readJson(jsonFile);
    const rewritten = rewriteOrigin(raw, origin);
    writeJson(jsonFile, rewritten);
  }
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
      `Found unreplaced origin "${DEFAULT_REGISTRY_ORIGIN}" in registry output:\n${offenders.join("\n")}`,
    );
  }
}

function syncKeyscopeAssets(keyscopeManifest) {
  const assetsDir = keyscopeManifest.docs.assetsDir
    ? resolve(KEYSCOPE_ROOT, keyscopeManifest.docs.assetsDir)
    : null;
  if (!assetsDir || !existsSync(assetsDir)) return;

  const outputDir = resolve(DOCS_ROOT, "public/keyscope-assets");
  resetDir(outputDir);
  cpSync(assetsDir, outputDir, { recursive: true, force: true });
}

function main() {
  ensureExists(DIFF_UI_MANIFEST_PATH, "diff-ui internal docs manifest");
  ensureExists(KEYSCOPE_MANIFEST_PATH, "keyscope internal docs manifest");

  const diffManifest = readJson(DIFF_UI_MANIFEST_PATH);
  const keyscopeManifest = readJson(KEYSCOPE_MANIFEST_PATH);
  const origin = normalizeOrigin(process.env.REGISTRY_ORIGIN);

  console.log("[docs-sync] Building diff-ui docs data...");
  run("pnpm", ["--dir", DIFF_UI_ROOT, "build:docs-data"], WORKSPACE_ROOT);

  console.log("[docs-sync] Syncing diff-ui docs, generated JSON, registry source and styles...");
  syncDiffUiArtifacts(diffManifest);

  console.log("[docs-sync] Syncing keyscope docs content...");
  syncKeyscopeDocs(keyscopeManifest);
  syncKeyscopeAssets(keyscopeManifest);

  console.log(`[docs-sync] Syncing registries with origin ${origin}...`);
  syncRegistries(diffManifest, keyscopeManifest, origin);
  assertNoDefaultOrigin(DOCS_PUBLIC_REGISTRY_DIR, origin);

  console.log("[docs-sync] Done.");
}

main();
