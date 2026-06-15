import { err, ok, type Result } from "@diffgazer/core/result";
import type { TrustConfig } from "@diffgazer/core/schemas/config";
import { getFileMtimeMs } from "../fs.js";
import { getGlobalTrustPath } from "../paths.js";
import { loadTrust, persistTrustRecordAsync, persistTrustRemovalAsync } from "./persistence.js";
import { persistError } from "./secrets-store.js";
import { createMutex, runConfigTransaction } from "./transaction.js";
import type { SecretsStorageError, TrustState } from "./types.js";

export interface TrustStore {
  getTrust(projectId: string): TrustConfig | null;
  listTrustedProjects(): TrustConfig[];
  saveTrust(config: TrustConfig): Promise<Result<TrustConfig, SecretsStorageError>>;
  removeTrust(projectId: string): Promise<Result<boolean, SecretsStorageError>>;
}

/**
 * Owns trust state: persistent project trust (file-backed) plus per-session
 * trust. This is the one cleanly separable concern in the config store — it does
 * not touch config/secrets/provider state, so it lives in its own module.
 */
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

  // Record-granular persist: re-reads trust.json and merges the single mutated
  // record before the atomic write, so a record another instance wrote during
  // this window is never erased (F-359).
  const persistTrustWith = async (
    write: () => Promise<void>,
  ): Promise<Result<void, SecretsStorageError>> => {
    try {
      await write();
      trustState = loadTrust();
      trustMtimeMs = getFileMtimeMs(getGlobalTrustPath());
      return ok(undefined);
    } catch (cause) {
      return err(persistError("trust", cause));
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
      sessionTrust[config.projectId] = config;
      return Promise.resolve(ok(config));
    }
    return mutex.run(() =>
      runConfigTransaction(
        {
          ...transactionDeps,
          persist: () => persistTrustWith(() => persistTrustRecordAsync(config)),
        },
        () => {
          trustState.projects[config.projectId] = config;
          return ok(config);
        },
      ),
    );
  };

  const removeTrust = (projectId: string): Promise<Result<boolean, SecretsStorageError>> =>
    mutex.run(() => {
      // Session trust is purely in-memory, so its removal needs no disk refresh.
      const removedSession = projectId in sessionTrust;
      if (removedSession) delete sessionTrust[projectId];
      // Refresh once, then decide persistent membership against that single
      // freshly-read state; only the persistent path enters the transaction (which
      // reuses the same state without refreshing again), so there is no redundant
      // double refresh on the removal path.
      refreshTrustState();
      if (!(projectId in trustState.projects)) return Promise.resolve(ok(removedSession));
      return runConfigTransaction(
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
    });

  return { getTrust, listTrustedProjects, saveTrust, removeTrust };
}
