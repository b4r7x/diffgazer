// Settings functionality has been moved to features/settings/hooks/use-settings-state.ts
// This hook provides backwards compatibility for existing imports.

import { useState, useCallback } from "react";
import type { SettingsConfig } from "@repo/schemas/settings";
import { settingsApi } from "../features/settings/api/settings-api.js";
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
  loadSettings: () => Promise<void>;
  saveSettings: (config: SettingsConfig) => Promise<void>;
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

  const loadSettings = useCallback(async (): Promise<void> => {
    await loadOp.execute(async () => {
      const result = await settingsApi.loadSettings();
      const config = result ?? DEFAULT_SETTINGS;
      setSettings(config);
      return config;
    });
  }, [loadOp]);

  const saveSettings = useCallback(
    async (config: SettingsConfig): Promise<void> => {
      await saveOp.execute(async () => {
        await settingsApi.saveSettings(config);
        setSettings(config);
      });
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
