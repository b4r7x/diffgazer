import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import { getConfig, getProviderStatus } from "@/features/settings/api/config-api";

interface ConfigContextValue {
    provider?: string;
    model?: string;
    isConfigured: boolean;
    isLoading: boolean;
    error: string | null;
    refresh: () => Promise<void>;
}

const ConfigContext = createContext<ConfigContextValue | undefined>(undefined);

export function ConfigProvider({ children }: { children: ReactNode }) {
    const [provider, setProvider] = useState<string | undefined>();
    const [model, setModel] = useState<string | undefined>();
    const [isConfigured, setIsConfigured] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const refresh = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            // Fetch both config and provider status
            const [configData, statusData] = await Promise.all([
                getConfig().catch(() => null),
                getProviderStatus().catch(() => null)
            ]);

            if (configData) {
                setProvider(configData.provider);
                setModel(configData.model);
            }

            setIsConfigured(!!statusData?.configured);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to load configuration");
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        refresh();
    }, [refresh]);

    return (
        <ConfigContext.Provider value={{ provider, model, isConfigured, isLoading, error, refresh }}>
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
