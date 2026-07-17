import { execFileSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  collectMissingWorkspaceArtifactFiles,
  getArtifactLibraries,
  readDocsLibrariesConfig,
} from "@diffgazer/registry";
import { generateSectionsWithIndex } from "./generate-sections-with-index.mjs";
import { syncArtifacts } from "./sync-artifacts.mjs";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const DOCS_ROOT = resolve(dirname(SCRIPT_PATH), "..");
const WORKSPACE_ROOT = resolve(DOCS_ROOT, "../..");
const DOCS_LIBRARIES_CONFIG_PATH = resolve(DOCS_ROOT, "config/docs-libraries.json");

export function shouldPrepareLibraryArtifacts(options = {}) {
  const env = options.env ?? process.env;
  const workspaceRoot = options.workspaceRoot ?? WORKSPACE_ROOT;
  const configPath = options.configPath ?? DOCS_LIBRARIES_CONFIG_PATH;
  const warn = options.warn ?? console.warn;

  if (env.DIFFGAZER_SKIP_ARTIFACT_PREPARE !== "1") return true;

  const docsLibraries = readDocsLibrariesConfig(configPath);
  const artifactLibraries = getArtifactLibraries(docsLibraries);
  const missingFiles = collectMissingWorkspaceArtifactFiles(workspaceRoot, artifactLibraries);
  if (missingFiles.length === 0) return false;

  warn(
    [
      "[docs-sync] Missing prepared workspace artifacts; rebuilding library artifacts.",
      ...missingFiles.map((file) => `- ${file.relativePath}`),
    ].join("\n"),
  );
  return true;
}

function runPrepareLibraryArtifacts(workspaceRoot) {
  execFileSync("pnpm", ["--dir", workspaceRoot, "run", "prepare:library-artifacts"], {
    stdio: "inherit",
  });
}

async function runLogoGenerator(docsRoot) {
  await import(pathToFileURL(resolve(docsRoot, "scripts/generate-logo-ascii.mjs")).href);
}

export async function prepareGenerated(options = {}) {
  const env = options.env ?? process.env;
  const docsRoot = options.docsRoot ?? DOCS_ROOT;
  const workspaceRoot = options.workspaceRoot ?? WORKSPACE_ROOT;
  const configPath = options.configPath ?? DOCS_LIBRARIES_CONFIG_PATH;
  const warn = options.warn ?? console.warn;

  if (shouldPrepareLibraryArtifacts({ env, docsRoot, workspaceRoot, configPath, warn })) {
    (options.runPrepareLibraryArtifacts ?? runPrepareLibraryArtifacts)(workspaceRoot);
  }

  await (options.runSyncArtifacts ?? syncArtifacts)({
    docsRoot,
    workspaceRoot,
    configPath,
    env,
  });
  await (options.runGenerateLogoAscii ?? runLogoGenerator)(docsRoot);
  await (options.runGenerateSectionsWithIndex ?? generateSectionsWithIndex)({
    contentDocsDir: resolve(docsRoot, "content/docs"),
    outputPath: resolve(docsRoot, "src/generated/sections-with-index.ts"),
  });
}

if (process.argv[1] === SCRIPT_PATH) {
  await prepareGenerated();
}
