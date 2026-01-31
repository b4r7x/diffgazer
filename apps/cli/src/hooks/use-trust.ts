// Trust functionality has been moved to features/settings/hooks/use-settings-state.ts
// This hook provides backwards compatibility for existing imports.

import { useState, useCallback } from "react";
import type { TrustConfig } from "@repo/schemas/settings";
import { settingsApi } from "../features/settings/api/settings-api.js";
import { useAsyncOperation, type AsyncStatus } from "./use-async-operation.js";

export type TrustLoadState = "idle" | "loading" | "loaded" | "error";
export type TrustSaveState = "idle" | "saving" | "success" | "error";

function mapToLoadState(status: AsyncStatus): TrustLoadState {
  if (status === "success") return "loaded";
  return status as TrustLoadState;
}

function mapToSaveState(status: AsyncStatus): TrustSaveState {
  if (status === "loading") return "saving";
  return status as TrustSaveState;
}

export interface UseTrustResult {
  loadState: TrustLoadState;
  saveState: TrustSaveState;
  trustConfig: TrustConfig | null;
  error: { message: string } | null;
  loadTrust: (projectId: string) => Promise<TrustConfig | null>;
  saveTrust: (config: TrustConfig) => Promise<void>;
  checkTrust: (projectId: string) => Promise<boolean>;
}

/**
 * @deprecated Use useSettingsState from features/settings instead
 */
export function useTrust(): UseTrustResult {
  const loadOp = useAsyncOperation<TrustConfig | null>();
  const saveOp = useAsyncOperation<void>();
  const [trustConfig, setTrustConfig] = useState<TrustConfig | null>(null);

  const loadTrust = useCallback(
    async (projectId: string): Promise<TrustConfig | null> => {
      const result = await loadOp.execute(async () => {
        return await settingsApi.loadTrust(projectId);
      });
      if (result !== null) {
        setTrustConfig(result);
      }
      return result;
    },
    [loadOp]
  );

  const saveTrust = useCallback(
    async (config: TrustConfig): Promise<void> => {
      await saveOp.execute(async () => {
        await settingsApi.saveTrust(config);
      });
      setTrustConfig(config);
    },
    [saveOp]
  );

  const checkTrust = useCallback(async (projectId: string): Promise<boolean> => {
    try {
      const result = await settingsApi.loadTrust(projectId);
      return result !== null;
    } catch {
      return false;
    }
  }, []);

  const loadState = mapToLoadState(loadOp.state.status);
  const saveState = mapToSaveState(saveOp.state.status);

  const error = loadOp.state.error ?? saveOp.state.error ?? null;

  return {
    loadState,
    saveState,
    trustConfig,
    error,
    loadTrust,
    saveTrust,
    checkTrust,
  };
}
