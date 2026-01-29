import { useState, useCallback } from "react";
import type { Result } from "@repo/core";
import type { StoreError } from "@repo/core/storage";
import {
  loadSettings as loadSettingsStorage,
  saveSettings as saveSettingsStorage,
} from "@repo/core/storage";
import type { SettingsConfig } from "@repo/schemas/settings";
import { useAsyncOperation, type AsyncStatus } from "./use-async-operation.js";

export type LocalSettingsLoadState = "idle" | "loading" | "loaded" | "error";
export type LocalSettingsSaveState = "idle" | "saving" | "success" | "error";

function mapToLoadState(status: AsyncStatus): LocalSettingsLoadState {
  if (status === "success") return "loaded";
  return status as LocalSettingsLoadState;
}

function mapToSaveState(status: AsyncStatus): LocalSettingsSaveState {
  if (status === "loading") return "saving";
  return status as LocalSettingsSaveState;
}

export interface UseSettingsResult {
  loadState: LocalSettingsLoadState;
  saveState: LocalSettingsSaveState;
  settings: SettingsConfig | null;
  error: { message: string } | null;
  loadSettings: () => Promise<Result<SettingsConfig | null, StoreError>>;
  saveSettings: (config: SettingsConfig) => Promise<Result<void, StoreError>>;
}

const DEFAULT_SETTINGS: SettingsConfig = {
  theme: "auto",
  defaultLenses: ["correctness"],
  defaultProfile: null,
  severityThreshold: "medium",
};

/**
 * @deprecated Use useSettingsState from features/settings instead
 */
export function useSettings(): UseSettingsResult {
  const loadOp = useAsyncOperation<SettingsConfig | null>();
  const saveOp = useAsyncOperation<void>();
  const [settings, setSettings] = useState<SettingsConfig | null>(null);

  const loadSettings = useCallback(async (): Promise<Result<SettingsConfig | null, StoreError>> => {
    const result = await loadSettingsStorage();

    if (result.ok) {
      const config = result.value ?? DEFAULT_SETTINGS;
      setSettings(config);
      loadOp.setData(config);
    }

    return result;
  }, [loadOp]);

  const saveSettings = useCallback(
    async (config: SettingsConfig): Promise<Result<void, StoreError>> => {
      const result = await saveSettingsStorage(config);

      if (result.ok) {
        setSettings(config);
        saveOp.setData(undefined);
      }

      return result;
    },
    [saveOp]
  );

  const loadState = mapToLoadState(loadOp.state.status);
  const saveState = mapToSaveState(saveOp.state.status);

  const error = loadOp.state.error ?? saveOp.state.error ?? null;

  return {
    loadState,
    saveState,
    settings,
    error,
    loadSettings,
    saveSettings,
  };
}
