import { execFileSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  collectMissingWorkspaceArtifactFiles,
  getArtifactLibraries,
  readDocsLibrariesConfig,
  resolveArtifactSyncMode,
} from "../../../scripts/monorepo/artifacts/sync.mjs";

const DOCS_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const WORKSPACE_ROOT = resolve(DOCS_ROOT, "../..");
const DOCS_LIBRARIES_CONFIG_PATH = resolve(DOCS_ROOT, "config/docs-libraries.json");

function shouldPrepareLibraryArtifacts() {
  if (process.env.DIFFGAZER_SKIP_ARTIFACT_PREPARE !== "1") return true;

  const docsLibraries = readDocsLibrariesConfig(DOCS_LIBRARIES_CONFIG_PATH);
  const artifactLibraries = getArtifactLibraries(docsLibraries);
  const syncMode = resolveArtifactSyncMode(process.env, {
    libraries: artifactLibraries,
    resolveFromDir: DOCS_ROOT,
  });
  if (syncMode !== "workspace") return false;

  const missingFiles = collectMissingWorkspaceArtifactFiles(WORKSPACE_ROOT, artifactLibraries);
  if (missingFiles.length === 0) return false;

  console.warn(
    [
      "[docs-sync] Missing prepared workspace artifacts; rebuilding library artifacts.",
      ...missingFiles.map((file) => `- ${file.relativePath}`),
    ].join("\n"),
  );
  return true;
}

if (shouldPrepareLibraryArtifacts()) {
  execFileSync("pnpm", ["--dir", WORKSPACE_ROOT, "run", "prepare:library-artifacts"], {
    stdio: "inherit",
  });
}

await import(pathToFileURL(resolve(DOCS_ROOT, "scripts/sync-artifacts.mjs")).href);
await import(pathToFileURL(resolve(DOCS_ROOT, "scripts/generate-logo-ascii.mjs")).href);
