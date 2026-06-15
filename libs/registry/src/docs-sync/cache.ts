import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, relative, resolve } from "node:path";
import { collectAllFiles, resolveInside } from "../utils/fs.js";
import type { LoadedLibraryArtifacts, SyncOutputPaths, SyncState } from "./types.js";

export function computeSyncFingerprint(
  origin: string,
  syncSchemaVersion: number,
  artifacts: LoadedLibraryArtifacts[],
  extraRootPages: string[] = [],
  rootTitle?: string,
): string {
  const hash = createHash("sha256");
  hash.update(`origin:${origin}\n`);
  hash.update(`sync-schema:${syncSchemaVersion}\n`);
  hash.update(`root-title:${rootTitle ?? ""}\n`);
  hash.update(`extra-root-pages:${extraRootPages.join(",")}\n`);

  for (const artifact of artifacts) {
    hash.update(`${artifact.id}:manifest:${artifact.manifestPath}\n`);
    hash.update(readFileSync(artifact.manifestPath, "utf-8"));
    hash.update("\n");
    hash.update(`${artifact.id}:fingerprint:${artifact.fingerprintPath}\n`);
    hash.update(artifact.fingerprint);
    hash.update("\n");
  }

  return hash.digest("hex");
}

export function readSyncState(stateFilePath: string): SyncState | null {
  if (!existsSync(stateFilePath)) return null;
  try {
    const parsed = JSON.parse(readFileSync(stateFilePath, "utf-8"));
    if (typeof parsed.fingerprint !== "string") return null;
    if (typeof parsed.origin !== "string") return null;
    if (typeof parsed.syncedAt !== "string") return null;
    return {
      fingerprint: parsed.fingerprint,
      origin: parsed.origin,
      syncedAt: parsed.syncedAt,
    };
  } catch {
    return null;
  }
}

export function writeSyncState(stateFilePath: string, state: SyncState): void {
  mkdirSync(dirname(stateFilePath), { recursive: true });
  writeFileSync(stateFilePath, `${JSON.stringify(state, null, 2)}\n`);
}

function docsOutputsExist(
  artifacts: LoadedLibraryArtifacts[],
  paths: SyncOutputPaths,
  primaryLibraryId: string,
): boolean {
  const required = [resolve(paths.contentDir, "meta.json")];

  for (const artifact of artifacts) {
    required.push(resolve(paths.contentDir, artifact.id, "meta.json"));
    required.push(resolve(paths.publicRegistryDir, artifact.id, "registry.json"));
    for (const generatedFile of artifact.generatedFiles) {
      required.push(resolve(paths.generatedDir, artifact.id, basename(generatedFile)));
    }

    const sourceAssetsDirRel = artifact.manifest.docs.assetsDir;
    if (sourceAssetsDirRel) {
      const sourceAssetsDir = resolveInside(
        artifact.artifactRoot,
        sourceAssetsDirRel,
        `${artifact.id} artifact assets path`,
      );
      if (existsSync(sourceAssetsDir)) {
        required.push(resolve(paths.libraryAssetsDir, artifact.id));
      }
    }

    if (artifact.id === primaryLibraryId) continue;

    const sourceRegistryDirRel = artifact.manifest.source?.registryDir;
    if (!sourceRegistryDirRel) continue;
    const sourceExamplesDir = resolveInside(
      artifact.artifactRoot,
      `${sourceRegistryDirRel}/examples`,
      `${artifact.id} artifact examples path`,
    );
    if (existsSync(sourceExamplesDir)) {
      const targetExamplesDir = resolve(paths.registryDir, "examples", artifact.id);
      required.push(targetExamplesDir);
      for (const sourceFile of collectAllFiles(sourceExamplesDir)) {
        required.push(resolve(targetExamplesDir, relative(sourceExamplesDir, sourceFile)));
      }
    }
  }

  return required.every((filePath) => existsSync(filePath));
}

export function shouldSkipSync(params: {
  syncState: SyncState | null;
  syncFingerprint: string;
  artifacts: LoadedLibraryArtifacts[];
  paths: SyncOutputPaths;
  primaryLibraryId: string;
}): boolean {
  const { syncState, syncFingerprint, artifacts, paths, primaryLibraryId } = params;
  if (syncState?.fingerprint !== syncFingerprint) return false;

  return docsOutputsExist(artifacts, paths, primaryLibraryId);
}
