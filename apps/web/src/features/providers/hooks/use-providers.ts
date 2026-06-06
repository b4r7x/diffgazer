import { mapProvidersWithStatus } from '@diffgazer/core/providers';
import { useConfigActions, useConfigData } from '@/app/providers/config';

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
