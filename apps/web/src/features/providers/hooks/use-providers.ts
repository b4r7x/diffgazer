import { useMemo } from 'react';
import { useConfigData, useConfigActions } from '@/app/providers/config-provider';
import { AVAILABLE_PROVIDERS } from '@stargazer/schemas/config';
import type { ProviderWithStatus } from '../types';

export function useProviders() {
    const { providerStatus } = useConfigData();
    const { isLoading, saveCredentials, deleteProviderCredentials, activateProvider } = useConfigActions();

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

    return {
        providers,
        isLoading,
        saveApiKey: saveCredentials,
        removeApiKey: deleteProviderCredentials,
        selectProvider: activateProvider,
    };
}
