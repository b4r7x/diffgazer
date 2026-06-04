import { loadLibraryArtifacts } from "./loader.js";
import { runDocsSyncPass } from "./sync-operations.js";
import {
  computeSyncFingerprint,
  readSyncState,
  writeSyncState,
  shouldSkipSync,
} from "./cache.js";
import { resolveSyncOutputPaths } from "./paths.js";
import { assertSafeLibraryId } from "./library-id-validation.js";
import { defaultLogger } from "../logger.js";
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
    logger = defaultLogger,
  } = options;

  const paths = resolveSyncOutputPaths(docsRoot, outputPathOverrides);

  assertSafeLibraryId(primaryLibraryId, "Primary library id");
  for (const library of libraries) {
    assertSafeLibraryId(library.id, `Library id "${library.id}"`);
  }

  logger.info(`[docs-sync] Mode: ${mode}`);

  const artifacts = libraries.map((lib) =>
    loadLibraryArtifacts(lib, mode, docsRoot, workspaceRoot),
  );

  const primaryArtifact = artifacts.find((a) => a.id === primaryLibraryId);
  if (!primaryArtifact) {
    throw new Error(
      `Primary docs artifact "${primaryLibraryId}" is not configured.`,
    );
  }

  const syncFingerprint = computeSyncFingerprint(
    origin,
    syncSchemaVersion,
    artifacts,
    extraRootPages ?? [],
    rootTitle,
  );
  const syncState = readSyncState(paths.stateFilePath, logger);

  if (shouldSkipSync({
    syncState,
    syncFingerprint,
    artifacts,
    paths,
    primaryLibraryId,
  })) {
    logger.info("[docs-sync] Artifacts unchanged; skipping sync.");
    return { synced: false, fingerprint: syncFingerprint, artifacts };
  }

  logger.info("[docs-sync] Syncing docs and generated artifacts...");
  runDocsSyncPass({ artifacts, primaryArtifact, paths, origin, sourceOrigin, afterSync, rootTitle, extraRootPages, logger });

  writeSyncState(paths.stateFilePath, {
    fingerprint: syncFingerprint,
    origin,
    syncedAt: new Date().toISOString(),
  });

  logger.info("[docs-sync] Done.");
  return { synced: true, fingerprint: syncFingerprint, artifacts };
}
