import { createError, getErrorMessage } from "@diffgazer/core/errors";
import { err, ok, type Result } from "@diffgazer/core/result";
import type { TrustConfig } from "@diffgazer/core/schemas/config";
import { getFileMtimeMs } from "../fs.js";
import { log } from "../log.js";
import { getGlobalTrustPath } from "../paths.js";
import {
  loadTrust,
  persistTrustRecordAsync,
  persistTrustRemovalAsync,
} from "./persistence/trust.js";
import { createMutex } from "./transaction/mutex.js";
import type { SecretsStorageError, SecretsStorageErrorCode, TrustState } from "./types.js";

export interface TrustStore {
  getTrust(projectId: string): TrustConfig | null;
  listTrustedProjects(): TrustConfig[];
  saveTrust(config: TrustConfig): Promise<Result<TrustConfig, SecretsStorageError>>;
  removeTrust(projectId: string): Promise<Result<boolean, SecretsStorageError>>;
}

export function createTrustStore(): TrustStore {
  let trustState: TrustState = loadTrust();
  let trustMtimeMs: number | null = getFileMtimeMs(getGlobalTrustPath());

  const mutex = createMutex();

  const cloneTrustState = (state: TrustState): TrustState => ({
    projects: Object.fromEntries(
      Object.entries(state.projects).map(([projectId, trust]) => [projectId, { ...trust }]),
    ),
  });

  const refreshTrustState = (): void => {
    const currentMtime = getFileMtimeMs(getGlobalTrustPath());
    if (currentMtime === trustMtimeMs) return;
    trustState = loadTrust();
    trustMtimeMs = currentMtime;
  };

  // Record-granular persist: the write re-reads and merges the single mutated record,
  // so a record another instance wrote during this window is never erased.
  const persistTrustWith = async (
    write: () => Promise<void>,
  ): Promise<Result<void, SecretsStorageError>> => {
    try {
      await write();
      trustState = loadTrust();
      trustMtimeMs = getFileMtimeMs(getGlobalTrustPath());
      return ok(undefined);
    } catch (cause) {
      // Log the raw cause (carries the absolute path) server-side; return a path-free
      // message.
      log("error", "trust_persist_failed", { error: getErrorMessage(cause) });
      return err(createError<SecretsStorageErrorCode>("PERSIST_FAILED", "Failed to persist trust"));
    }
  };

  /**
   * One trust mutation under transactional discipline: snapshot for rollback →
   * mutate in memory → persist → on persist failure restore the snapshot and
   * surface the error. Callers run it inside the mutex so two concurrent
   * mutators never interleave.
   */
  const mutateAndPersist = async <T>(
    mutate: () => T,
    write: () => Promise<void>,
  ): Promise<Result<T, SecretsStorageError>> => {
    const backup = cloneTrustState(trustState);
    const value = mutate();
    const persisted = await persistTrustWith(write);
    if (!persisted.ok) {
      trustState = backup;
      return persisted;
    }
    return ok(value);
  };

  const getTrust = (projectId: string): TrustConfig | null => {
    refreshTrustState();
    return trustState.projects[projectId] ?? null;
  };

  const listTrustedProjects = (): TrustConfig[] => {
    refreshTrustState();
    return Object.values(trustState.projects);
  };

  const saveTrust = (config: TrustConfig): Promise<Result<TrustConfig, SecretsStorageError>> =>
    mutex.run(() => {
      refreshTrustState();
      return mutateAndPersist(
        () => {
          trustState.projects[config.projectId] = config;
          return config;
        },
        () => persistTrustRecordAsync(config),
      );
    });

  const removeTrust = (projectId: string): Promise<Result<boolean, SecretsStorageError>> =>
    mutex.run(async () => {
      refreshTrustState();
      if (!(projectId in trustState.projects)) {
        return ok(false);
      }
      return mutateAndPersist(
        () => {
          delete trustState.projects[projectId];
          return true;
        },
        () => persistTrustRemovalAsync(projectId),
      );
    });

  return { getTrust, listTrustedProjects, saveTrust, removeTrust };
}
