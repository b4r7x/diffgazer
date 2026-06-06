import { resolveInside } from "../utils/fs.js";
import type { SyncOutputPaths, SyncOutputPathsConfig } from "./types.js";
import { DEFAULT_OUTPUT_PATHS } from "./types.js";

export function resolveSyncOutputPaths(
  docsRoot: string,
  overrides?: Partial<SyncOutputPathsConfig>,
): SyncOutputPaths {
  const paths = { ...DEFAULT_OUTPUT_PATHS, ...overrides };
  return {
    contentDir: resolveInside(docsRoot, paths.contentDir, "docs content output path"),
    generatedDir: resolveInside(docsRoot, paths.generatedDir, "docs generated output path"),
    registryDir: resolveInside(docsRoot, paths.registryDir, "docs registry output path"),
    publicRegistryDir: resolveInside(docsRoot, paths.publicRegistryDir, "docs public registry output path"),
    libraryAssetsDir: resolveInside(docsRoot, paths.libraryAssetsDir, "docs library assets output path"),
    stateFilePath: resolveInside(docsRoot, paths.stateFile, "docs sync state output path"),
  };
}
