import { resolveInside } from "../utils/fs.js";
import type { SyncOutputPaths } from "./types.js";
import { DEFAULT_OUTPUT_PATHS } from "./types.js";

export function resolveSyncOutputPaths(docsRoot: string): SyncOutputPaths {
  return {
    contentDir: resolveInside(
      docsRoot,
      DEFAULT_OUTPUT_PATHS.contentDir,
      "docs content output path",
    ),
    generatedDir: resolveInside(
      docsRoot,
      DEFAULT_OUTPUT_PATHS.generatedDir,
      "docs generated output path",
    ),
    registryDir: resolveInside(
      docsRoot,
      DEFAULT_OUTPUT_PATHS.registryDir,
      "docs registry output path",
    ),
    publicRegistryDir: resolveInside(
      docsRoot,
      DEFAULT_OUTPUT_PATHS.publicRegistryDir,
      "docs public registry output path",
    ),
    libraryAssetsDir: resolveInside(
      docsRoot,
      DEFAULT_OUTPUT_PATHS.libraryAssetsDir,
      "docs library assets output path",
    ),
    stateFilePath: resolveInside(
      docsRoot,
      DEFAULT_OUTPUT_PATHS.stateFile,
      "docs sync state output path",
    ),
  };
}
