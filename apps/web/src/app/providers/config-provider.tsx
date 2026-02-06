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
import type { AIProvider, ProviderStatus, TrustConfig } from "@/types/config";
import { DEFAULT_TTL } from "@/lib/constants";
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
  const [provider, setProvider] = useState<AIProvider | undefined>();
  const [model, setModel] = useState<string | undefined>();
  const [isConfigured, setIsConfigured] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [providerStatus, setProviderStatus] = useState<ProviderStatus[]>([]);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [repoRoot, setRepoRoot] = useState<string | null>(null);
  const [trust, setTrust] = useState<TrustConfig | null>(null);

  const stateRef = useRef({ provider, model, projectId, repoRoot, trust });
  stateRef.current = { provider, model, projectId, repoRoot, trust };

  const applyConfigData = useCallback((data: ConfigData) => {
    setProvider(data.provider);
    setModel(data.model);
    setProviderStatus(data.providers);
    setIsConfigured(
      data.providers.some(
        (status) =>
          status.isActive &&
          (status.provider !== "openrouter" || Boolean(status.model))
      )
    );
    setProjectId(data.projectId);
    setRepoRoot(data.repoRoot);
    setTrust(data.trust);
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
    provider,
    model,
    isConfigured,
    isLoading,
    isSaving,
    error,
    providerStatus,
    projectId,
    repoRoot,
    trust,
    refresh,
    activateProvider,
    saveCredentials,
    deleteProviderCredentials,
  }), [
    provider, model, isConfigured, isLoading, isSaving, error,
    providerStatus, projectId, repoRoot, trust,
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
