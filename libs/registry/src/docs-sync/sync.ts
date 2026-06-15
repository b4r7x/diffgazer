import { log } from "../logger.js";
import { computeSyncFingerprint, readSyncState, shouldSkipSync, writeSyncState } from "./cache.js";
import { assertSafeLibraryId } from "./library-id-validation.js";
import { loadLibraryArtifacts } from "./loader.js";
import { resolveSyncOutputPaths } from "./paths.js";
import { runDocsSyncPass } from "./sync-operations.js";
import type { SyncDocsOptions, SyncDocsResult } from "./types.js";

export function syncDocsFromArtifacts(options: SyncDocsOptions): SyncDocsResult {
  const {
    docsRoot,
    workspaceRoot,
    libraries,
    primaryLibraryId,
    origin,
    sourceOrigin,
    mode,
    syncSchemaVersion = 3,
    afterSync,
    outputPaths: outputPathOverrides,
    rootTitle,
    extraRootPages,
  } = options;

  const paths = resolveSyncOutputPaths(docsRoot, outputPathOverrides);

  assertSafeLibraryId(primaryLibraryId, "Primary library id");
  for (const library of libraries) {
    assertSafeLibraryId(library.id, `Library id "${library.id}"`);
  }

  log.info(`[docs-sync] Mode: ${mode}`);

  const artifacts = libraries.map((lib) =>
    loadLibraryArtifacts(lib, mode, docsRoot, workspaceRoot, origin),
  );

  const primaryArtifact = artifacts.find((a) => a.id === primaryLibraryId);
  if (!primaryArtifact) {
    throw new Error(`Primary docs artifact "${primaryLibraryId}" is not configured.`);
  }

  const syncFingerprint = computeSyncFingerprint(
    origin,
    syncSchemaVersion,
    artifacts,
    extraRootPages ?? [],
    rootTitle,
  );
  const syncState = readSyncState(paths.stateFilePath);

  if (
    shouldSkipSync({
      syncState,
      syncFingerprint,
      artifacts,
      paths,
      primaryLibraryId,
    })
  ) {
    log.info("[docs-sync] Artifacts unchanged; skipping sync.");
    return { synced: false, fingerprint: syncFingerprint, artifacts };
  }

  log.info("[docs-sync] Syncing docs and generated artifacts...");
  runDocsSyncPass({
    artifacts,
    primaryArtifact,
    paths,
    origin,
    sourceOrigin,
    afterSync,
    rootTitle,
    extraRootPages,
  });

  writeSyncState(paths.stateFilePath, {
    fingerprint: syncFingerprint,
    origin,
    syncedAt: new Date().toISOString(),
  });

  log.info("[docs-sync] Done.");
  return { synced: true, fingerprint: syncFingerprint, artifacts };
}
