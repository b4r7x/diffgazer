import { err, ok, type Result } from "@diffgazer/core/result";
import type { TrustConfig } from "@diffgazer/core/schemas/config";
import { getFileMtimeMs } from "../fs.js";
import { getGlobalTrustPath } from "../paths.js";
import { loadTrust, persistTrustAsync } from "./persistence.js";
import { persistError } from "./secrets-store.js";
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

  const persistTrust = async (): Promise<Result<void, SecretsStorageError>> => {
    try {
      await persistTrustAsync(trustState);
      trustMtimeMs = getFileMtimeMs(getGlobalTrustPath());
      return ok(undefined);
    } catch (cause) {
      return err(persistError("trust", cause));
    }
  };

  const getTrust = (projectId: string): TrustConfig | null => {
    refreshTrustState();
    return sessionTrust[projectId] ?? trustState.projects[projectId] ?? null;
  };

  const listTrustedProjects = (): TrustConfig[] => {
    refreshTrustState();
    return Object.values({ ...trustState.projects, ...sessionTrust });
  };

  const saveTrust = async (
    config: TrustConfig,
  ): Promise<Result<TrustConfig, SecretsStorageError>> => {
    if (config.trustMode === "session") {
      sessionTrust[config.projectId] = config;
      return ok(config);
    }
    refreshTrustState();
    const backup = cloneTrustState(trustState);
    trustState.projects[config.projectId] = config;
    refreshTrustState();
    trustState.projects[config.projectId] = config;
    const result = await persistTrust();
    if (!result.ok) {
      trustState = backup;
      return result;
    }
    return ok(config);
  };

  const removeTrust = async (projectId: string): Promise<Result<boolean, SecretsStorageError>> => {
    refreshTrustState();
    const inSession = projectId in sessionTrust;
    const inPersistent = projectId in trustState.projects;
    if (!inSession && !inPersistent) return ok(false);
    if (inSession) delete sessionTrust[projectId];
    if (inPersistent) {
      const backup = cloneTrustState(trustState);
      delete trustState.projects[projectId];
      refreshTrustState();
      delete trustState.projects[projectId];
      const result = await persistTrust();
      if (!result.ok) {
        trustState = backup;
        return result;
      }
    }
    return ok(true);
  };

  return { getTrust, listTrustedProjects, saveTrust, removeTrust };
}
