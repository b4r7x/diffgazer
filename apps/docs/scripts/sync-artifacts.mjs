import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  normalizeOrigin,
  syncDocsFromArtifacts,
} from "@b4r7x/registry-kit";
import {
  assertArtifactSyncOutputs,
  getArtifactLibraries,
  readDocsLibrariesConfig,
  resolveArtifactSyncMode,
} from "./sync-artifacts-lib.mjs";

const DOCS_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const WORKSPACE_ROOT = resolve(DOCS_ROOT, "../../..");
const DOCS_LIBRARIES_CONFIG_PATH = resolve(DOCS_ROOT, "config/docs-libraries.json");

const DIFFGAZER_ORIGIN = "https://diffgazer.com";

const docsLibraries = readDocsLibrariesConfig(DOCS_LIBRARIES_CONFIG_PATH);
const artifactLibraries = getArtifactLibraries(docsLibraries);

syncDocsFromArtifacts({
  docsRoot: DOCS_ROOT,
  workspaceRoot: WORKSPACE_ROOT,
  libraries: artifactLibraries,
  primaryLibraryId: docsLibraries.primaryLibraryId,
  origin: normalizeOrigin(process.env.REGISTRY_ORIGIN, { defaultOrigin: DIFFGAZER_ORIGIN }),
  sourceOrigin: DIFFGAZER_ORIGIN,
  mode: resolveArtifactSyncMode(process.env, {
    libraries: artifactLibraries,
    resolveFromDir: DOCS_ROOT,
  }),
});

assertArtifactSyncOutputs({
  docsRoot: DOCS_ROOT,
  primaryLibraryId: docsLibraries.primaryLibraryId,
  libraries: artifactLibraries,
});
