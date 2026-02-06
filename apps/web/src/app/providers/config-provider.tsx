import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AIProviderSchema } from "@stargazer/schemas/config";
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

function invalidateConfigCache(): void {
  configCache = null;
}

interface ConfigState {
  provider?: AIProvider;
  model?: string;
  providerStatus: ProviderStatus[];
  projectId: string | null;
  repoRoot: string | null;
  trust: TrustConfig | null;
}

const initialConfigState: ConfigState = {
  provider: undefined,
  model: undefined,
  providerStatus: [],
  projectId: null,
  repoRoot: null,
  trust: null,
};

// Stable data context — changes only when config data itself changes
interface ConfigDataContextValue {
  provider?: AIProvider;
  model?: string;
  isConfigured: boolean;
  providerStatus: ProviderStatus[];
  projectId: string | null;
  repoRoot: string | null;
  trust: TrustConfig | null;
}

// Volatile actions context — changes with loading/saving state
interface ConfigActionsContextValue {
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  refresh: (invalidate?: boolean) => Promise<void>;
  activateProvider: (providerId: string, model?: string) => Promise<void>;
  saveCredentials: (
    provider: AIProvider,
    apiKey: string,
    model?: string,
  ) => Promise<void>;
  deleteProviderCredentials: (provider: AIProvider) => Promise<void>;
}

const ConfigDataContext = createContext<ConfigDataContextValue | undefined>(undefined);
const ConfigActionsContext = createContext<ConfigActionsContextValue | undefined>(undefined);

export function ConfigProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState(initialConfigState);
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
    setState({
      provider: data.provider,
      model: data.model,
      providerStatus: data.providers,
      projectId: data.projectId,
      repoRoot: data.repoRoot,
      trust: data.trust,
    });
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
            AIProviderSchema.safeParse(initData.config?.provider).data,
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
        await updateAfterAction(AIProviderSchema.safeParse(result.provider).data, result.model);
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

  const dataValue = useMemo<ConfigDataContextValue>(() => ({
    provider: state.provider,
    model: state.model,
    isConfigured,
    providerStatus: state.providerStatus,
    projectId: state.projectId,
    repoRoot: state.repoRoot,
    trust: state.trust,
  }), [state]);

  const actionsValue = useMemo<ConfigActionsContextValue>(() => ({
    isLoading,
    isSaving,
    error,
    refresh,
    activateProvider,
    saveCredentials,
    deleteProviderCredentials,
  }), [isLoading, isSaving, error, refresh, activateProvider, saveCredentials, deleteProviderCredentials]);

  return (
    <ConfigDataContext.Provider value={dataValue}>
      <ConfigActionsContext.Provider value={actionsValue}>
        {children}
      </ConfigActionsContext.Provider>
    </ConfigDataContext.Provider>
  );
}

export function useConfigData(): ConfigDataContextValue {
  const context = useContext(ConfigDataContext);
  if (context === undefined) {
    throw new Error("useConfigData must be used within a ConfigProvider");
  }
  return context;
}

export function useConfigActions(): ConfigActionsContextValue {
  const context = useContext(ConfigActionsContext);
  if (context === undefined) {
    throw new Error("useConfigActions must be used within a ConfigProvider");
  }
  return context;
}

