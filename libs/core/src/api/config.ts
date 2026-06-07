import type {
  ActivateProviderResponse,
  ConfigCheckResponse,
  CurrentConfigResponse as ConfigResponse,
  DeleteConfigResponse,
  DeleteProviderCredentialsResponse as DeleteProviderResponse,
  InitResponse,
  OpenRouterModelsResponse,
  ProviderModelsResponse,
  ProvidersStatusResponse,
  SaveConfigRequest,
  SettingsConfig,
  TrustConfig,
} from "../schemas/config/index.js";
import {
  OpenRouterModelsResponseSchema,
  ProviderModelsResponseSchema,
} from "../schemas/config/index.js";
import type { ApiClient, TrustListResponse, TrustResponse } from "./types.js";

export async function getProviderStatus(
  client: ApiClient,
): Promise<ProvidersStatusResponse["providers"]> {
  const response = await client.get<ProvidersStatusResponse>("/api/config/providers");
  return response.providers;
}

export async function getOpenRouterModels(client: ApiClient): Promise<OpenRouterModelsResponse> {
  // OpenRouter's model catalog is externally controlled and changes often, so
  // validate the payload shape rather than trusting the response type.
  return client.get<OpenRouterModelsResponse>(
    "/api/config/provider/openrouter/models",
    undefined,
    (body) => OpenRouterModelsResponseSchema.parse(body),
  );
}

export async function getProviderModels(
  client: ApiClient,
  providerId: string,
): Promise<ProviderModelsResponse> {
  // The catalog is models.dev-backed and changes often, so validate the slim
  // payload shape rather than trusting the response type.
  return client.get<ProviderModelsResponse>(
    `/api/config/provider/${providerId}/models`,
    undefined,
    (body) => ProviderModelsResponseSchema.parse(body),
  );
}

export async function saveConfig(client: ApiClient, config: SaveConfigRequest): Promise<void> {
  await client.post("/api/config", config);
}

export async function getSettings(client: ApiClient): Promise<SettingsConfig> {
  return client.get<SettingsConfig>("/api/settings");
}

export async function saveSettings(
  client: ApiClient,
  settings: Partial<SettingsConfig>,
): Promise<void> {
  await client.post("/api/settings", settings);
}

export async function activateProvider(
  client: ApiClient,
  providerId: string,
  model?: string,
): Promise<ActivateProviderResponse> {
  return client.post<ActivateProviderResponse>(
    `/api/config/provider/${providerId}/activate`,
    model ? { model } : {},
  );
}

export async function deleteProviderCredentials(
  client: ApiClient,
  providerId: string,
): Promise<DeleteProviderResponse> {
  return client.delete<DeleteProviderResponse>(`/api/config/provider/${providerId}`);
}

export async function loadInit(client: ApiClient): Promise<InitResponse> {
  return client.get<InitResponse>("/api/config/init");
}

export async function checkConfig(client: ApiClient): Promise<ConfigCheckResponse> {
  return client.get<ConfigCheckResponse>("/api/config/check");
}

export async function getConfig(client: ApiClient): Promise<ConfigResponse> {
  return client.get<ConfigResponse>("/api/config");
}

export async function deleteConfig(client: ApiClient): Promise<DeleteConfigResponse> {
  return client.delete<DeleteConfigResponse>("/api/config");
}

export async function getTrust(client: ApiClient, projectId: string): Promise<TrustResponse> {
  return client.get<TrustResponse>("/api/settings/trust", { projectId });
}

export async function listTrustedProjects(client: ApiClient): Promise<TrustListResponse> {
  return client.get<TrustListResponse>("/api/settings/trust/list");
}

export async function saveTrust(client: ApiClient, trust: TrustConfig): Promise<TrustResponse> {
  return client.post<TrustResponse>("/api/settings/trust", trust);
}

export async function deleteTrust(
  client: ApiClient,
  projectId: string,
): Promise<{ removed: boolean }> {
  return client.delete<{ removed: boolean }>("/api/settings/trust", { projectId });
}

export const bindConfig = (client: ApiClient) => ({
  getProviderStatus: () => getProviderStatus(client),
  getOpenRouterModels: () => getOpenRouterModels(client),
  getProviderModels: (providerId: string) => getProviderModels(client, providerId),
  saveConfig: (config: SaveConfigRequest) => saveConfig(client, config),
  getSettings: () => getSettings(client),
  saveSettings: (settings: Partial<SettingsConfig>) => saveSettings(client, settings),
  activateProvider: (providerId: string, model?: string) =>
    activateProvider(client, providerId, model),
  deleteProviderCredentials: (providerId: string) => deleteProviderCredentials(client, providerId),
  loadInit: () => loadInit(client),
  checkConfig: () => checkConfig(client),
  getConfig: () => getConfig(client),
  deleteConfig: () => deleteConfig(client),
  getTrust: (projectId: string) => getTrust(client, projectId),
  listTrustedProjects: () => listTrustedProjects(client),
  saveTrust: (trust: TrustConfig) => saveTrust(client, trust),
  deleteTrust: (projectId: string) => deleteTrust(client, projectId),
});
