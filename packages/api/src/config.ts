import type {
  ApiClient,
  InitResponse,
  ProvidersStatusResponse,
  SaveConfigRequest,
  SettingsConfig,
} from "./types.js";

export async function getProviderStatus(
  client: ApiClient
): Promise<ProvidersStatusResponse["providers"]> {
  const response = await client.get<ProvidersStatusResponse>("/api/config/providers");
  return response.providers;
}

export async function saveConfig(client: ApiClient, config: SaveConfigRequest): Promise<void> {
  await client.post("/api/config", config);
}

export async function getSettings(client: ApiClient): Promise<SettingsConfig> {
  return client.get<SettingsConfig>("/api/settings");
}

export async function saveSettings(
  client: ApiClient,
  settings: Partial<SettingsConfig>
): Promise<void> {
  await client.post("/api/settings", settings);
}

export async function activateProvider(
  client: ApiClient,
  providerId: string,
  model?: string
): Promise<{ provider: string; model?: string }> {
  return client.post(`/api/config/provider/${providerId}/activate`, model ? { model } : undefined);
}

export async function deleteProviderCredentials(
  client: ApiClient,
  providerId: string
): Promise<{ deleted: boolean; provider: string }> {
  return client.delete(`/api/config/provider/${providerId}`);
}

export async function loadInit(client: ApiClient): Promise<InitResponse> {
  return client.get<InitResponse>("/api/config/init");
}

export const bindConfig = (client: ApiClient) => ({
  getProviderStatus: () => getProviderStatus(client),
  saveConfig: (config: SaveConfigRequest) => saveConfig(client, config),
  getSettings: () => getSettings(client),
  saveSettings: (settings: Partial<SettingsConfig>) => saveSettings(client, settings),
  activateProvider: (providerId: string, model?: string) =>
    activateProvider(client, providerId, model),
  deleteProviderCredentials: (providerId: string) => deleteProviderCredentials(client, providerId),
  loadInit: () => loadInit(client),
});
