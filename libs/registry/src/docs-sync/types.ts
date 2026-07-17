import type { ArtifactManifest } from "../manifest.js";

export interface SyncLibraryConfig {
  id: string;
  workspaceDir: string;
}

export interface SyncDocsOptions {
  docsRoot: string;
  workspaceRoot: string;
  libraries: SyncLibraryConfig[];
  primaryLibraryId: string;
  origin: string;
  sourceOrigin: string;
  syncSchemaVersion?: number;
  afterSync?: (ctx: AfterSyncContext) => void;
  outputPaths?: Partial<SyncOutputPathsConfig>;
}

export interface AfterSyncContext {
  libraryId: string;
  generatedDir: string;
}

export interface SyncDocsResult {
  synced: boolean;
  fingerprint: string;
  artifacts: LoadedLibraryArtifacts[];
}

export interface LoadedLibraryArtifacts {
  id: string;
  manifest: ArtifactManifest;
  manifestPath: string;
  artifactRoot: string;
  fingerprintPath: string;
  fingerprint: string;
  generatedFiles: string[];
}

export interface SyncOutputPathsConfig {
  contentDir: string;
  generatedDir: string;
  registryDir: string;
  publicRegistryDir: string;
  libraryAssetsDir: string;
  stateFile: string;
}

export const DEFAULT_OUTPUT_PATHS: SyncOutputPathsConfig = {
  contentDir: "content/docs",
  generatedDir: "src/generated",
  registryDir: "registry",
  publicRegistryDir: "public/r",
  libraryAssetsDir: "public/library-assets",
  stateFile: ".cache/sync-artifacts-state.json",
};

export interface SyncOutputPaths {
  contentDir: string;
  generatedDir: string;
  registryDir: string;
  publicRegistryDir: string;
  libraryAssetsDir: string;
  stateFilePath: string;
}

export interface SyncState {
  fingerprint: string;
  origin: string;
  syncedAt: string;
}
