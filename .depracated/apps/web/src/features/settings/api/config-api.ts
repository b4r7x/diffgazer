import { api } from '@/lib/api';
import type {
    SettingsConfig,
    ProviderStatus,
    ProvidersStatusResponse,
    SaveConfigRequest,
    InitResponse
} from '@repo/schemas';

export type { ProviderStatus };

export async function getProviderStatus(): Promise<ProviderStatus[]> {
    const response = await api.get<ProvidersStatusResponse>('/config/providers');
    return response.providers;
}

export async function saveConfig(config: SaveConfigRequest): Promise<void> {
    await api.post('/config', config);
}

export async function getSettings(): Promise<SettingsConfig> {
    return api.get<SettingsConfig>('/settings');
}

export async function saveSettings(settings: Partial<SettingsConfig>): Promise<void> {
    await api.post('/settings', settings);
}

export async function activateProvider(
    providerId: string,
    model?: string
): Promise<{ provider: string; model?: string }> {
    return api.post(`/config/provider/${providerId}/activate`, model ? { model } : undefined);
}

export async function deleteProviderCredentials(
    providerId: string
): Promise<{ deleted: boolean; provider: string }> {
    return api.delete(`/config/provider/${providerId}`);
}

export async function loadInit(): Promise<InitResponse> {
    return api.get('/config/init');
}
