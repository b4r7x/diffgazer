import { useState, useEffect, useCallback, useMemo } from 'react';
import {
    getProvidersStatus,
    saveApiKey as saveApiKeyApi,
    removeApiKey as removeApiKeyApi,
    selectActiveProvider,
} from '../api/providers-api';
import {
    AVAILABLE_PROVIDERS,
    type AIProvider,
    type ProviderInfo,
    type ProviderStatus,
} from '@repo/schemas';

export interface ProviderWithStatus extends ProviderInfo {
    hasApiKey: boolean;
    isActive: boolean;
    model?: string;
}

export function useProviders() {
    const [statuses, setStatuses] = useState<ProviderStatus[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    const fetchStatus = useCallback(async () => {
        setIsLoading(true);
        try {
            const data = await getProvidersStatus();
            setStatuses(data);
            setError(null);
        } catch (e) {
            setError(e instanceof Error ? e : new Error(String(e)));
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchStatus();
    }, [fetchStatus]);

    const providers: ProviderWithStatus[] = useMemo(() => {
        return AVAILABLE_PROVIDERS.map((provider) => {
            const status = statuses.find((s) => s.provider === provider.id);
            return {
                ...provider,
                hasApiKey: status?.hasApiKey ?? false,
                isActive: status?.isActive ?? false,
                model: status?.model,
            };
        });
    }, [statuses]);

    const activeProvider = useMemo(() => {
        return providers.find((p) => p.isActive) ?? null;
    }, [providers]);

    const saveApiKey = useCallback(
        async (provider: AIProvider, key: string, method: 'paste' | 'env' = 'paste') => {
            await saveApiKeyApi(provider, key, method);
            await fetchStatus();
        },
        [fetchStatus]
    );

    const removeApiKey = useCallback(
        async (provider: AIProvider) => {
            await removeApiKeyApi(provider);
            await fetchStatus();
        },
        [fetchStatus]
    );

    const selectProvider = useCallback(
        async (provider: AIProvider, model?: string) => {
            await selectActiveProvider(provider, model);
            await fetchStatus();
        },
        [fetchStatus]
    );

    return {
        providers,
        activeProvider,
        isLoading,
        error,
        refetch: fetchStatus,
        saveApiKey,
        removeApiKey,
        selectProvider,
    };
}
