import { useState, useCallback } from "react";
import type { Result } from "@repo/core";
import type { StoreError } from "@repo/core/storage";
import {
  loadTrust as loadTrustStorage,
  saveTrust as saveTrustStorage,
} from "@repo/core/storage";
import type { TrustConfig } from "@repo/schemas/settings";
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
  loadTrust: (projectId: string) => Promise<Result<TrustConfig | null, StoreError>>;
  saveTrust: (config: TrustConfig) => Promise<Result<void, StoreError>>;
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
    async (projectId: string): Promise<Result<TrustConfig | null, StoreError>> => {
      const result = await loadTrustStorage(projectId);

      if (result.ok) {
        setTrustConfig(result.value);
        loadOp.setData(result.value);
      }

      return result;
    },
    [loadOp]
  );

  const saveTrust = useCallback(
    async (config: TrustConfig): Promise<Result<void, StoreError>> => {
      const result = await saveTrustStorage(config);

      if (result.ok) {
        setTrustConfig(config);
        saveOp.setData(undefined);
      }

      return result;
    },
    [saveOp]
  );

  const checkTrust = useCallback(async (projectId: string): Promise<boolean> => {
    const result = await loadTrustStorage(projectId);
    return result.ok && result.value !== null;
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
