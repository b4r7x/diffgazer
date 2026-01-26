import { api } from '@/lib/api';
import type {
    UserConfig,
    SettingsConfig,
    ProviderStatus,
    ProvidersStatusResponse,
    SaveConfigRequest
} from '@repo/schemas';

export async function getProviderStatus(): Promise<ProviderStatus[]> {
    const response = await api.get<ProvidersStatusResponse>('/config/providers');
    return response.providers;
}

export async function getConfig(): Promise<UserConfig | null> {
    try {
        return await api.get<UserConfig>('/config');
    } catch (e) {
        // Config may not exist yet
        return null;
    }
}

export async function saveConfig(config: SaveConfigRequest): Promise<void> {
    await api.post('/config', config);
}

export async function deleteConfig(): Promise<void> {
    await api.delete('/config');
}

export async function getSettings(): Promise<SettingsConfig> {
    return api.get<SettingsConfig>('/settings');
}

export async function saveSettings(settings: Partial<SettingsConfig>): Promise<void> {
    await api.post('/settings', settings);
}

export type { UserConfig, SettingsConfig, ProviderStatus, SaveConfigRequest };
