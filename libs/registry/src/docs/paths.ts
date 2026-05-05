import { resolve } from "node:path";
import type { SyncOutputPaths, SyncOutputPathsConfig } from "./types.js";
import { DEFAULT_OUTPUT_PATHS } from "./types.js";

export function resolveSyncOutputPaths(
  docsRoot: string,
  overrides?: Partial<SyncOutputPathsConfig>,
): SyncOutputPaths {
  const paths = { ...DEFAULT_OUTPUT_PATHS, ...overrides };
  return {
    contentDir: resolve(docsRoot, paths.contentDir),
    generatedDir: resolve(docsRoot, paths.generatedDir),
    registryDir: resolve(docsRoot, paths.registryDir),
    stylesDir: resolve(docsRoot, paths.stylesDir),
    publicRegistryDir: resolve(docsRoot, paths.publicRegistryDir),
    libraryAssetsDir: resolve(docsRoot, paths.libraryAssetsDir),
    stateFilePath: resolve(docsRoot, paths.stateFile),
  };
}
