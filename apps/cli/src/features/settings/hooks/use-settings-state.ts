import { useState, useCallback, useMemo } from "react";
import { useAsyncOperation } from "../../../hooks/use-async-operation.js";
import type {
  AIProvider,
  ProviderStatus,
  ConfigCheckResponse,
  CurrentConfigResponse,
  ProvidersStatusResponse,
} from "@repo/schemas/config";
import type { SettingsConfig, TrustConfig, Theme, ControlsMode } from "@repo/schemas/settings";
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
  saveControlsMode: (mode: ControlsMode) => Promise<void>;
  saveTrust: (config: TrustConfig) => Promise<void>;
  saveCredentials: (provider: AIProvider, apiKey: string, model?: string) => Promise<void>;
  deleteConfig: () => Promise<void>;
}

const DEFAULT_SETTINGS: SettingsConfig = {
  theme: "auto",
  controlsMode: "menu",
  defaultLenses: ["correctness"],
  defaultProfile: null,
  severityThreshold: "medium",
};

export function useSettingsState(projectId: string, repoRoot: string): UseSettingsStateResult {
  const loadOp = useAsyncOperation<{
    settings: SettingsConfig | null;
    trust: TrustConfig | null;
    config: ConfigCheckResponse;
    providerStatus: ProvidersStatusResponse;
  }>();
  const saveOp = useAsyncOperation<void>();

  const [settings, setSettings] = useState<SettingsConfig | null>(null);
  const [trust, setTrust] = useState<TrustConfig | null>(null);
  const [config, setConfig] = useState<{ provider: string; model?: string } | null>(null);
  const [providerStatus, setProviderStatus] = useState<ProviderStatus[]>([]);
  const [isConfigured, setIsConfigured] = useState(false);

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

      setSettings(settingsData);
      setTrust(trustData);
      setIsConfigured(configData.configured);
      setProviderStatus(providerData.providers);

      if (configData.configured) {
        setConfig({
          provider: configData.config.provider,
          model: configData.config.model,
        });
      } else {
        setConfig(null);
      }

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
      if (!settings) return;

      await saveOp.execute(async () => {
        const updatedSettings = { ...settings, theme };
        await settingsApi.saveSettings(updatedSettings);
        setSettings(updatedSettings);
      });
    },
    [saveOp, settings]
  );

  const saveControlsMode = useCallback(
    async (mode: ControlsMode) => {
      if (!settings) return;

      await saveOp.execute(async () => {
        const updatedSettings = { ...settings, controlsMode: mode };
        await settingsApi.saveSettings(updatedSettings);
        setSettings(updatedSettings);
      });
    },
    [saveOp, settings]
  );

  const saveTrust = useCallback(
    async (trustConfig: TrustConfig) => {
      await saveOp.execute(async () => {
        await settingsApi.saveTrust(trustConfig);
        setTrust(trustConfig);
      });
    },
    [saveOp]
  );

  const saveCredentials = useCallback(
    async (provider: AIProvider, apiKey: string, model?: string) => {
      await saveOp.execute(async () => {
        const result = await settingsApi.saveConfig(provider, apiKey, model);
        setConfig({ provider: result.provider, model: result.model });
        setIsConfigured(true);

        const providerData = await settingsApi.loadProviderStatus();
        setProviderStatus(providerData.providers);
      });
    },
    [saveOp]
  );

  const deleteConfig = useCallback(async () => {
    await saveOp.execute(async () => {
      await settingsApi.deleteConfig();
      setConfig(null);
      setIsConfigured(false);

      const providerData = await settingsApi.loadProviderStatus();
      setProviderStatus(providerData.providers);
    });
  }, [saveOp]);

  const isLoading = loadOp.state.status === "loading";
  const isSaving = saveOp.state.status === "loading";
  const error = loadOp.state.error ?? saveOp.state.error ?? null;

  const isTrusted = useMemo(() => !!trust, [trust]);
  const activeProvider = useMemo(() => config?.provider, [config]);

  return {
    isLoading,
    isSaving,
    settings,
    trust,
    config,
    providerStatus,
    isConfigured,
    error,
    isTrusted,
    activeProvider,
    loadAll,
    saveTheme,
    saveControlsMode,
    saveTrust,
    saveCredentials,
    deleteConfig,
  };
}
