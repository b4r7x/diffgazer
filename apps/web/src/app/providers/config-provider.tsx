import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import {
    loadInit,
    activateProvider as apiActivateProvider,
    saveConfig as apiSaveConfig,
    deleteProviderCredentials as apiDeleteProviderCredentials,
    getProviderStatus,
    type ProviderStatus,
} from "@/features/settings/api/config-api";
import type { AIProvider } from "@repo/schemas/config";

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

interface CacheEntry {
  data: { provider?: AIProvider; model?: string; providers: ProviderStatus[] };
  timestamp: number;
}

let configCache: CacheEntry | null = null;

function getCached(): CacheEntry["data"] | null {
  if (!configCache) return null;
  if (Date.now() - configCache.timestamp > CACHE_TTL) {
    configCache = null;
    return null;
  }
  return configCache.data;
}

function setCache(data: CacheEntry["data"]): void {
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
    refresh: () => Promise<void>;
    activateProvider: (providerId: string, model?: string) => Promise<void>;
    saveCredentials: (provider: AIProvider, apiKey: string, model?: string) => Promise<void>;
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

    const refresh = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const cached = getCached();
            if (cached) {
                setProvider(cached.provider);
                setModel(cached.model);
                setProviderStatus(cached.providers);
                setIsConfigured(cached.providers.some(p => p.isActive));
            } else {
                const initData = await loadInit();
                if (initData.config) {
                    setProvider(initData.config.provider as AIProvider);
                    setModel(initData.config.model);
                } else {
                    setProvider(undefined);
                    setModel(undefined);
                }
                setIsConfigured(initData.configured);
                setProviderStatus(initData.providers);
                setCache({
                    provider: initData.config?.provider as AIProvider | undefined,
                    model: initData.config?.model,
                    providers: initData.providers,
                });
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to load configuration");
        } finally {
            setIsLoading(false);
        }
    }, []);

    const activateProvider = useCallback(async (providerId: string, selectedModel?: string) => {
        setIsSaving(true);
        setError(null);
        try {
            invalidateConfigCache();
            const result = await apiActivateProvider(providerId, selectedModel);
            const providers = await getProviderStatus();
            setProvider(result.provider as AIProvider);
            setModel(result.model);
            setIsConfigured(true);
            setProviderStatus(providers);
            setCache({ provider: result.provider as AIProvider, model: result.model, providers });
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to activate provider");
            throw err;
        } finally {
            setIsSaving(false);
        }
    }, []);

    const saveCredentials = useCallback(async (providerName: AIProvider, apiKey: string, selectedModel?: string) => {
        setIsSaving(true);
        setError(null);
        try {
            invalidateConfigCache();
            await apiSaveConfig({ provider: providerName, apiKey, model: selectedModel });
            const providers = await getProviderStatus();
            setProvider(providerName);
            setModel(selectedModel);
            setIsConfigured(true);
            setProviderStatus(providers);
            setCache({ provider: providerName, model: selectedModel, providers });
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to save credentials");
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
            await apiDeleteProviderCredentials(providerName);
            const providers = await getProviderStatus();
            const wasActive = provider === providerName;
            if (wasActive) {
                setProvider(undefined);
                setModel(undefined);
                setIsConfigured(false);
            }
            setProviderStatus(providers);
            setCache({ provider: wasActive ? undefined : provider, model: wasActive ? undefined : model, providers });
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to delete provider credentials");
            throw err;
        } finally {
            setIsSaving(false);
        }
    }, [provider, model]);

    useEffect(() => {
        refresh();
    }, [refresh]);

    const value: ConfigContextValue = {
        provider,
        model,
        isConfigured,
        isLoading,
        isSaving,
        error,
        providerStatus,
        refresh,
        activateProvider,
        saveCredentials,
        deleteProviderCredentials,
    };

    return (
        <ConfigContext.Provider value={value}>
            {children}
        </ConfigContext.Provider>
    );
}

export function useConfigContext() {
    const context = useContext(ConfigContext);
    if (context === undefined) {
        throw new Error("useConfigContext must be used within a ConfigProvider");
    }
    return context;
}
