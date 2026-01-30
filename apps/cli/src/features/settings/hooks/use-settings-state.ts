import { useState, useCallback, useMemo } from "react";
import { useAsyncOperation } from "../../../hooks/use-async-operation.js";
import type {
  AIProvider,
  ProviderStatus,
  ConfigCheckResponse,
  CurrentConfigResponse,
  ProvidersStatusResponse,
} from "@repo/schemas/config";
import type { SettingsConfig, TrustConfig, Theme } from "@repo/schemas/settings";
import { settingsApi } from "../api/settings-api.js";

export interface SettingsState {
  isLoading: boolean;
  isSaving: boolean;
  settings: SettingsConfig | null;
  trust: TrustConfig | null;
  config: { provider: string; model?: string } | null;
  providerStatus: ProviderStatus[];
  isConfigured: boolean;
  error: { message: string } | null;
}

export interface UseSettingsStateResult extends SettingsState {
  isTrusted: boolean;
  activeProvider: string | undefined;
  loadAll: () => Promise<void>;
  saveTheme: (theme: Theme) => Promise<void>;
  saveTrust: (config: TrustConfig) => Promise<void>;
  saveCredentials: (provider: AIProvider, apiKey: string, model?: string) => Promise<void>;
  deleteConfig: () => Promise<void>;
}

const DEFAULT_SETTINGS: SettingsConfig = {
  theme: "auto",
  defaultLenses: ["correctness"],
  defaultProfile: null,
  severityThreshold: "medium",
};

interface SettingsDataState {
  settings: SettingsConfig | null;
  trust: TrustConfig | null;
  config: { provider: string; model?: string } | null;
  providerStatus: ProviderStatus[];
  isConfigured: boolean;
}

const INITIAL_DATA_STATE: SettingsDataState = {
  settings: null,
  trust: null,
  config: null,
  providerStatus: [],
  isConfigured: false,
};

export function useSettingsState(projectId: string, repoRoot: string): UseSettingsStateResult {
  const loadOp = useAsyncOperation<{
    settings: SettingsConfig | null;
    trust: TrustConfig | null;
    config: ConfigCheckResponse;
    providerStatus: ProvidersStatusResponse;
  }>();
  const saveOp = useAsyncOperation<void>();

  const [dataState, setDataState] = useState<SettingsDataState>(INITIAL_DATA_STATE);

  const loadAll = useCallback(async () => {
    await loadOp.execute(async () => {
      const [settingsResult, trustResult, configResult, providerStatusResult] = await Promise.allSettled([
        settingsApi.loadSettings().catch(() => null),
        settingsApi.loadTrust(projectId).catch(() => null),
        settingsApi.checkConfig(),
        settingsApi.loadProviderStatus(),
      ]);

      const settingsData =
        settingsResult.status === "fulfilled" ? settingsResult.value ?? DEFAULT_SETTINGS : DEFAULT_SETTINGS;
      const trustData = trustResult.status === "fulfilled" ? trustResult.value : null;
      const configData = configResult.status === "fulfilled" ? configResult.value : { configured: false as const };
      const providerData =
        providerStatusResult.status === "fulfilled"
          ? providerStatusResult.value
          : { providers: [], activeProvider: undefined };

      // Single batched state update
      setDataState({
        settings: settingsData,
        trust: trustData,
        isConfigured: configData.configured,
        providerStatus: providerData.providers,
        config: configData.configured
          ? { provider: configData.config.provider, model: configData.config.model }
          : null,
      });

      return {
        settings: settingsData,
        trust: trustData,
        config: configData,
        providerStatus: providerData,
      };
    });
  }, [loadOp, projectId]);

  const saveTheme = useCallback(
    async (theme: Theme) => {
      if (!dataState.settings) return;

      await saveOp.execute(async () => {
        const updatedSettings = { ...dataState.settings!, theme };
        await settingsApi.saveSettings(updatedSettings);
        setDataState((prev) => ({ ...prev, settings: updatedSettings }));
      });
    },
    [saveOp, dataState.settings]
  );

  const saveTrust = useCallback(
    async (trustConfig: TrustConfig) => {
      await saveOp.execute(async () => {
        await settingsApi.saveTrust(trustConfig);
        setDataState((prev) => ({ ...prev, trust: trustConfig }));
      });
    },
    [saveOp]
  );

  const saveCredentials = useCallback(
    async (provider: AIProvider, apiKey: string, model?: string) => {
      await saveOp.execute(async () => {
        const result = await settingsApi.saveConfig(provider, apiKey, model);
        const providerData = await settingsApi.loadProviderStatus();
        setDataState((prev) => ({
          ...prev,
          config: { provider: result.provider, model: result.model },
          isConfigured: true,
          providerStatus: providerData.providers,
        }));
      });
    },
    [saveOp]
  );

  const deleteConfig = useCallback(async () => {
    await saveOp.execute(async () => {
      await settingsApi.deleteConfig();
      const providerData = await settingsApi.loadProviderStatus();
      setDataState((prev) => ({
        ...prev,
        config: null,
        isConfigured: false,
        providerStatus: providerData.providers,
      }));
    });
  }, [saveOp]);

  const isLoading = loadOp.state.status === "loading";
  const isSaving = saveOp.state.status === "loading";
  const error = loadOp.state.error ?? saveOp.state.error ?? null;

  const isTrusted = useMemo(() => !!dataState.trust, [dataState.trust]);
  const activeProvider = useMemo(() => dataState.config?.provider, [dataState.config]);

  return {
    isLoading,
    isSaving,
    settings: dataState.settings,
    trust: dataState.trust,
    config: dataState.config,
    providerStatus: dataState.providerStatus,
    isConfigured: dataState.isConfigured,
    error,
    isTrusted,
    activeProvider,
    loadAll,
    saveTheme,
    saveTrust,
    saveCredentials,
    deleteConfig,
  };
}
