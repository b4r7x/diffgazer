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
import type { AIProvider, ProviderStatus, TrustConfig, SetupStatus } from "@stargazer/schemas/config";
import { DEFAULT_TTL } from "@/config/constants";
import { api } from "@/lib/api";

interface ConfigData {
  provider?: AIProvider;
  model?: string;
  providers: ProviderStatus[];
  projectId: string | null;
  repoRoot: string | null;
  trust: TrustConfig | null;
  setupStatus: SetupStatus | null;
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
  setupStatus: SetupStatus | null;
}

const initialConfigState: ConfigState = {
  provider: undefined,
  model: undefined,
  providerStatus: [],
  projectId: null,
  repoRoot: null,
  trust: null,
  setupStatus: null,
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
  setupStatus: SetupStatus | null;
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

  const isConfigured = state.setupStatus?.isConfigured ?? false;

  const applyConfigData = (data: ConfigData) => {
    setState({
      provider: data.provider,
      model: data.model,
      providerStatus: data.providers,
      projectId: data.projectId,
      repoRoot: data.repoRoot,
      trust: data.trust,
      setupStatus: data.setupStatus,
    });
  };

  const updateAfterAction = async (
    newProvider: AIProvider | undefined,
    newModel: string | undefined,
  ) => {
    const [providers, initData] = await Promise.all([
      api.getProviderStatus(),
      api.loadInit(),
    ]);
    const data: ConfigData = {
      provider: newProvider,
      model: newModel,
      providers,
      projectId: initData.project.projectId,
      repoRoot: initData.project.path,
      trust: initData.project.trust,
      setupStatus: initData.setup as SetupStatus,
    };
    applyConfigData(data);
    setCache(data);
  };

  const refresh = useCallback(async (invalidate = false) => {
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
        setupStatus: initData.setup as SetupStatus,
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
  }, []);

  const activateProvider = useCallback(async (providerId: string, selectedModel?: string) => {
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
  }, []);

  const saveCredentials = useCallback(async (
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
  }, []);

  const deleteProviderCredentials = useCallback(async (providerName: AIProvider) => {
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
  }, []);

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
    setupStatus: state.setupStatus,
  }), [state.provider, state.model, isConfigured, state.providerStatus, state.projectId, state.repoRoot, state.trust, state.setupStatus]);

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

