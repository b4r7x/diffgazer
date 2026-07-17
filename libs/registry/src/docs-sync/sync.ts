import { log } from "../logger.js";
import { normalizeOrigin } from "../origin.js";
import { computeSyncFingerprint, readSyncState, shouldSkipSync, writeSyncState } from "./cache.js";
import { assertSafeLibraryId } from "./library-id-validation.js";
import { loadLibraryArtifacts } from "./loader.js";
import { resolveSyncOutputPaths } from "./paths.js";
import { assertArtifactOrigins, runDocsSyncPass } from "./sync-operations.js";
import type { SyncDocsOptions, SyncDocsResult } from "./types.js";

export function syncDocsFromArtifacts(options: SyncDocsOptions): SyncDocsResult {
  const {
    docsRoot,
    workspaceRoot,
    libraries,
    primaryLibraryId,
    origin: requestedOrigin,
    sourceOrigin,
    syncSchemaVersion = 3,
    afterSync,
    outputPaths: outputPathOverrides,
  } = options;
  assertSafeLibraryId(primaryLibraryId, "Primary library id");
  const libraryIds = new Set<string>();
  for (const library of libraries) {
    assertSafeLibraryId(library.id, `Library id "${library.id}"`);
    if (libraryIds.has(library.id)) {
      throw new Error(`Duplicate library id "${library.id}".`);
    }
    libraryIds.add(library.id);
  }

  const origin = normalizeOrigin(requestedOrigin);
  const paths = resolveSyncOutputPaths(docsRoot, outputPathOverrides);

  log.info("[docs-sync] Loading workspace artifacts.");

  const artifacts = libraries.map((lib) => loadLibraryArtifacts(lib, workspaceRoot, origin));
  assertArtifactOrigins(artifacts, origin);

  const primaryArtifact = artifacts.find((a) => a.id === primaryLibraryId);
  if (!primaryArtifact) {
    throw new Error(`Primary docs artifact "${primaryLibraryId}" is not configured.`);
  }

  const syncFingerprint = computeSyncFingerprint(origin, syncSchemaVersion, artifacts);
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
  });

  writeSyncState(paths.stateFilePath, {
    fingerprint: syncFingerprint,
    origin,
    syncedAt: new Date().toISOString(),
  });

  log.info("[docs-sync] Done.");
  return { synced: true, fingerprint: syncFingerprint, artifacts };
}
