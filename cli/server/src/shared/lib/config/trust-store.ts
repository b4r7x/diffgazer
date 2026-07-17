import { createError, getErrorMessage } from "@diffgazer/core/errors";
import { err, ok, type Result } from "@diffgazer/core/result";
import type { TrustConfig } from "@diffgazer/core/schemas/config";
import { getFileMtimeMs } from "../fs.js";
import { log } from "../log.js";
import { getGlobalTrustPath } from "../paths.js";
import { loadTrust, persistTrustRecordAsync, persistTrustRemovalAsync } from "./persistence.js";
import { createMutex, runConfigTransaction } from "./transaction.js";
import type { SecretsStorageError, SecretsStorageErrorCode, TrustState } from "./types.js";

export interface TrustStore {
  getTrust(projectId: string): TrustConfig | null;
  listTrustedProjects(): TrustConfig[];
  saveTrust(config: TrustConfig): Promise<Result<TrustConfig, SecretsStorageError>>;
  removeTrust(projectId: string): Promise<Result<boolean, SecretsStorageError>>;
}

// Owns persistent (file-backed) and per-session trust. A session grant shadows a
// persistent record for the same project and does not survive restarts, so downgrading
// to session trust also clears the persistent record — a restart cannot resurrect the
// older persistent grant (F-045).
export function createTrustStore(): TrustStore {
  let trustState: TrustState = loadTrust();
  const sessionTrust: Record<string, TrustConfig> = {};
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
  // so a record another instance wrote during this window is never erased (F-359).
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
      // message (F-085).
      log("error", "trust_persist_failed", { error: getErrorMessage(cause) });
      return err(createError<SecretsStorageErrorCode>("PERSIST_FAILED", "Failed to persist trust"));
    }
  };

  const transactionDeps = {
    refresh: refreshTrustState,
    snapshot: () => cloneTrustState(trustState),
    restore: (backup: TrustState) => {
      trustState = backup;
    },
  };

  const getTrust = (projectId: string): TrustConfig | null => {
    refreshTrustState();
    return sessionTrust[projectId] ?? trustState.projects[projectId] ?? null;
  };

  const listTrustedProjects = (): TrustConfig[] => {
    refreshTrustState();
    return Object.values({ ...trustState.projects, ...sessionTrust });
  };

  const saveTrust = (config: TrustConfig): Promise<Result<TrustConfig, SecretsStorageError>> => {
    if (config.trustMode === "session") {
      // Drop the persistent record, then record the session grant (F-045). Apply the
      // session grant only after the removal persists: on failure the transaction
      // restores the persistent record and returns err, so getTrust must not report a
      // session grant that was never persisted.
      return mutex.run(async () => {
        refreshTrustState();
        if (!(config.projectId in trustState.projects)) {
          sessionTrust[config.projectId] = config;
          return ok(config);
        }
        const result = await runConfigTransaction(
          {
            ...transactionDeps,
            refresh: () => {},
            persist: () => persistTrustWith(() => persistTrustRemovalAsync(config.projectId)),
          },
          () => {
            delete trustState.projects[config.projectId];
            return ok(config);
          },
        );
        if (result.ok) {
          sessionTrust[config.projectId] = config;
        }
        return result;
      });
    }
    return mutex.run(async () => {
      const result = await runConfigTransaction(
        {
          ...transactionDeps,
          persist: () => persistTrustWith(() => persistTrustRecordAsync(config)),
        },
        () => {
          trustState.projects[config.projectId] = config;
          return ok(config);
        },
      );
      if (result.ok) delete sessionTrust[config.projectId];
      return result;
    });
  };

  const removeTrust = (projectId: string): Promise<Result<boolean, SecretsStorageError>> =>
    mutex.run(async () => {
      const removedSession = projectId in sessionTrust;
      refreshTrustState();
      if (!(projectId in trustState.projects)) {
        if (removedSession) delete sessionTrust[projectId];
        return ok(removedSession);
      }
      const result = await runConfigTransaction(
        {
          ...transactionDeps,
          refresh: () => {},
          persist: () => persistTrustWith(() => persistTrustRemovalAsync(projectId)),
        },
        () => {
          delete trustState.projects[projectId];
          return ok(true);
        },
      );
      if (result.ok && removedSession) delete sessionTrust[projectId];
      return result;
    });

  return { getTrust, listTrustedProjects, saveTrust, removeTrust };
}
