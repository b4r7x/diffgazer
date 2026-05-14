import { useConfigData, useConfigActions } from '@/app/providers/config-provider';
import { mapProvidersWithStatus } from '@diffgazer/core/providers';

export function useProviders() {
    const { isLoading, providerStatus } = useConfigData();
    const { saveCredentials, deleteProviderCredentials, activateProvider } = useConfigActions();

    const providers = mapProvidersWithStatus(providerStatus);

    return {
        providers,
        isLoading,
        saveApiKey: saveCredentials,
        removeApiKey: deleteProviderCredentials,
        selectProvider: activateProvider,
    };
}
