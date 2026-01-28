import { api } from '@/lib/api';
import type {
    AIProvider,
    ProviderStatus,
    ProvidersStatusResponse,
    DeleteProviderCredentialsResponse,
} from '@repo/schemas';

export async function getProvidersStatus(): Promise<ProviderStatus[]> {
    const response = await api.get<ProvidersStatusResponse>('/config/providers');
    return response.providers;
}

export async function saveApiKey(
    provider: AIProvider,
    key: string,
    _method: 'paste' | 'env'
): Promise<void> {
    await api.post('/config', {
        provider,
        apiKey: key,
    });
}

export async function removeApiKey(provider: AIProvider): Promise<void> {
    await api.delete<DeleteProviderCredentialsResponse>(`/config/provider/${provider}`);
}

export async function selectActiveProvider(
    provider: AIProvider,
    model?: string
): Promise<void> {
    await api.post(`/config/provider/${provider}/activate`, { model });
}

export type { AIProvider, ProviderStatus };
