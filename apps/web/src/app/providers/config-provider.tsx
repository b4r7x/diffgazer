import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { AIProvider, ProviderStatus, TrustConfig } from "@stargazer/schemas/config";
import { OPENROUTER_PROVIDER_ID } from "@/config/constants";
import { DEFAULT_TTL } from "@/config/constants";
import { api } from "@/lib/api";

interface ConfigData {
  provider?: AIProvider;
  model?: string;
  providers: ProviderStatus[];
  projectId: string | null;
  repoRoot: string | null;
  trust: TrustConfig | null;
}

interface CacheEntry {
  data: ConfigData;
  timestamp: number;
}

let configCache: CacheEntry | null = null;

function getCached(): ConfigData | null {
  if (!configCache) return null;
  if (Date.now() - configCache.timestamp > DEFAULT_TTL) {
    configCache = null;
    return null;
  }
  return configCache.data;
}

function setCache(data: ConfigData): void {
  configCache = { data, timestamp: Date.now() };
}

export function invalidateConfigCache(): void {
  configCache = null;
}

// Reducer for related config state
interface ConfigState {
  provider?: AIProvider;
  model?: string;
  providerStatus: ProviderStatus[];
  projectId: string | null;
  repoRoot: string | null;
  trust: TrustConfig | null;
}

type ConfigAction =
  | { type: "SET_CONFIG"; data: ConfigData };

function configReducer(_state: ConfigState, action: ConfigAction): ConfigState {
  switch (action.type) {
    case "SET_CONFIG":
      return {
        provider: action.data.provider,
        model: action.data.model,
        providerStatus: action.data.providers,
        projectId: action.data.projectId,
        repoRoot: action.data.repoRoot,
        trust: action.data.trust,
      };
  }
}

const initialConfigState: ConfigState = {
  provider: undefined,
  model: undefined,
  providerStatus: [],
  projectId: null,
  repoRoot: null,
  trust: null,
};

interface ConfigContextValue {
  provider?: AIProvider;
  model?: string;
  isConfigured: boolean;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  providerStatus: ProviderStatus[];
  projectId: string | null;
  repoRoot: string | null;
  trust: TrustConfig | null;
  refresh: (invalidate?: boolean) => Promise<void>;
  activateProvider: (providerId: string, model?: string) => Promise<void>;
  saveCredentials: (
    provider: AIProvider,
    apiKey: string,
    model?: string,
  ) => Promise<void>;
  deleteProviderCredentials: (provider: AIProvider) => Promise<void>;
}

const ConfigContext = createContext<ConfigContextValue | undefined>(undefined);

export function ConfigProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(configReducer, initialConfigState);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stateRef = useRef(state);
  stateRef.current = state;

  const isConfigured = state.providerStatus.some(
    (s) =>
      s.isActive &&
      (s.provider !== OPENROUTER_PROVIDER_ID || Boolean(s.model))
  );

  const applyConfigData = useCallback((data: ConfigData) => {
    dispatch({ type: "SET_CONFIG", data });
  }, []);

  const refresh = useCallback(
    async (invalidate = false) => {
      if (invalidate) invalidateConfigCache();
      setIsLoading(true);
      setError(null);

      try {
        const cached = getCached();
        if (cached) {
          applyConfigData(cached);
          setIsLoading(false);
          return;
        }

        const initData = await api.loadInit();
        const data: ConfigData = {
          provider:
            (initData.config?.provider as AIProvider | undefined) ?? undefined,
          model: initData.config?.model,
          providers: initData.providers,
          projectId: initData.project.projectId,
          repoRoot: initData.project.path,
          trust: initData.project.trust,
        };
        applyConfigData(data);
        setCache(data);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load configuration",
        );
      } finally {
        setIsLoading(false);
      }
    },
    [applyConfigData],
  );

  const updateAfterAction = useCallback(
    async (
      newProvider: AIProvider | undefined,
      newModel: string | undefined,
    ) => {
      const providers = await api.getProviderStatus();
      const {
        projectId: cachedProjectId,
        repoRoot: cachedRepoRoot,
        trust: cachedTrust,
      } = stateRef.current;
      const data: ConfigData = {
        provider: newProvider,
        model: newModel,
        providers,
        projectId: cachedProjectId,
        repoRoot: cachedRepoRoot,
        trust: cachedTrust,
      };
      applyConfigData(data);
      setCache(data);
    },
    [applyConfigData],
  );

  const activateProvider = useCallback(
    async (providerId: string, selectedModel?: string) => {
      setIsSaving(true);
      setError(null);
      try {
        invalidateConfigCache();
        const result = await api.activateProvider(providerId, selectedModel);
        await updateAfterAction(result.provider as AIProvider, result.model);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to activate provider",
        );
        throw err;
      } finally {
        setIsSaving(false);
      }
    },
    [updateAfterAction],
  );

  const saveCredentials = useCallback(
    async (
      providerName: AIProvider,
      apiKey: string,
      selectedModel?: string,
    ) => {
      setIsSaving(true);
      setError(null);
      try {
        invalidateConfigCache();
        await api.saveConfig({
          provider: providerName,
          apiKey,
          model: selectedModel,
        });
        await updateAfterAction(providerName, selectedModel);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to save credentials",
        );
        throw err;
      } finally {
        setIsSaving(false);
      }
    },
    [updateAfterAction],
  );

  const deleteProviderCredentials = useCallback(
    async (providerName: AIProvider) => {
      setIsSaving(true);
      setError(null);
      try {
        invalidateConfigCache();
        await api.deleteProviderCredentials(providerName);
        const { provider: currentProvider, model: currentModel } =
          stateRef.current;
        const wasActive = currentProvider === providerName;
        await updateAfterAction(
          wasActive ? undefined : currentProvider,
          wasActive ? undefined : currentModel,
        );
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Failed to delete provider credentials",
        );
        throw err;
      } finally {
        setIsSaving(false);
      }
    },
    [updateAfterAction],
  );

  useEffect(() => {
    refresh();
  }, [refresh]);

  const value = useMemo<ConfigContextValue>(() => ({
    provider: state.provider,
    model: state.model,
    isConfigured,
    isLoading,
    isSaving,
    error,
    providerStatus: state.providerStatus,
    projectId: state.projectId,
    repoRoot: state.repoRoot,
    trust: state.trust,
    refresh,
    activateProvider,
    saveCredentials,
    deleteProviderCredentials,
  }), [
    state, isConfigured, isLoading, isSaving, error,
    refresh, activateProvider, saveCredentials, deleteProviderCredentials,
  ]);

  return (
    <ConfigContext.Provider value={value}>{children}</ConfigContext.Provider>
  );
}

export function useConfigContext(): ConfigContextValue {
  const context = useContext(ConfigContext);
  if (context === undefined) {
    throw new Error("useConfigContext must be used within a ConfigProvider");
  }
  return context;
}
