import { useCallback, useMemo } from 'react';
import { useConfigData, useConfigActions } from '@/app/providers/config-provider';
import {
    AVAILABLE_PROVIDERS,
    type AIProvider,
} from '@stargazer/schemas/config';
import type { ProviderWithStatus } from '../types';

export function useProviders() {
    const { providerStatus } = useConfigData();
    const { isLoading, refresh, saveCredentials, deleteProviderCredentials, activateProvider } = useConfigActions();

    const providers: ProviderWithStatus[] = useMemo(() => {
        return AVAILABLE_PROVIDERS.map((provider) => {
            const status = providerStatus.find((s) => s.provider === provider.id);
            const hasApiKey = status?.hasApiKey ?? false;
            const isActive = status?.isActive ?? false;
            return {
                ...provider,
                hasApiKey,
                isActive,
                model: status?.model,
                displayStatus: isActive ? 'active' : hasApiKey ? 'configured' : 'needs-key',
            };
        });
    }, [providerStatus]);

    const activeProvider = providers.find((p) => p.isActive) ?? null;

    const saveApiKey = useCallback(
        async (provider: AIProvider, key: string) => {
            await saveCredentials(provider, key);
        },
        [saveCredentials]
    );

    const removeApiKey = useCallback(
        async (provider: AIProvider) => {
            await deleteProviderCredentials(provider);
        },
        [deleteProviderCredentials]
    );

    const selectProvider = useCallback(
        async (provider: AIProvider, model?: string) => {
            await activateProvider(provider, model);
        },
        [activateProvider]
    );

    return {
        providers,
        activeProvider,
        isLoading,
        error: null,
        refetch: () => refresh(true),
        saveApiKey,
        removeApiKey,
        selectProvider,
    };
}
