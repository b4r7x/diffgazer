import { err, ok, type Result } from "@diffgazer/core/result";
import type { TrustConfig } from "@diffgazer/core/schemas/config";
import { getFileMtimeMs } from "../fs.js";
import { getGlobalTrustPath } from "../paths.js";
import { loadTrust, persistTrustAsync } from "./persistence.js";
import { persistError } from "./secrets-store.js";
import type {
  SecretsStorageError,
  SecretsStorageErrorCode,
  TrustState,
} from "./types.js";

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

  const persistTrust = async (
    failOnConflict: boolean = false,
  ): Promise<Result<void, SecretsStorageError>> => {
    const currentMtime = getFileMtimeMs(getGlobalTrustPath());
    if (trustMtimeMs !== null && currentMtime !== null && currentMtime !== trustMtimeMs) {
      if (failOnConflict) {
        return err({
          code: "CONCURRENCY_CONFLICT" as SecretsStorageErrorCode,
          message: "Trust file was modified concurrently; operation rejected for safety",
        });
      }
      const diskTrust = loadTrust();
      trustState = {
        projects: { ...diskTrust.projects, ...trustState.projects },
      };
    }
    try {
      await persistTrustAsync(trustState);
      trustMtimeMs = getFileMtimeMs(getGlobalTrustPath());
      return ok(undefined);
    } catch (cause) {
      return err(persistError("trust", cause));
    }
  };

  const getTrust = (projectId: string): TrustConfig | null =>
    sessionTrust[projectId] ?? trustState.projects[projectId] ?? null;

  const listTrustedProjects = (): TrustConfig[] =>
    Object.values({ ...trustState.projects, ...sessionTrust });

  const saveTrust = async (
    config: TrustConfig,
  ): Promise<Result<TrustConfig, SecretsStorageError>> => {
    if (config.trustMode === "session") {
      sessionTrust[config.projectId] = config;
      return ok(config);
    }
    trustState.projects[config.projectId] = config;
    const result = await persistTrust(false);
    if (!result.ok) {
      delete trustState.projects[config.projectId];
      return result;
    }
    return ok(config);
  };

  const removeTrust = async (
    projectId: string,
  ): Promise<Result<boolean, SecretsStorageError>> => {
    const inSession = projectId in sessionTrust;
    const inPersistent = projectId in trustState.projects;
    if (!inSession && !inPersistent) return ok(false);
    if (inSession) delete sessionTrust[projectId];
    if (inPersistent) {
      const backup = trustState.projects[projectId];
      delete trustState.projects[projectId];
      const result = await persistTrust(true);
      if (!result.ok) {
        if (backup === undefined) {
          delete trustState.projects[projectId];
        } else {
          trustState.projects[projectId] = backup;
        }
        return result;
      }
    }
    return ok(true);
  };

  return { getTrust, listTrustedProjects, saveTrust, removeTrust };
}
