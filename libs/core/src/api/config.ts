import type {
  ActivateProviderResponse,
  ConfigCheckResponse,
  CurrentConfigResponse as ConfigResponse,
  DeleteProviderCredentialsResponse as DeleteProviderResponse,
  InitResponse,
  OpenRouterModelsResponse,
  ProviderModelsResponse,
  ProvidersStatusResponse,
  SaveConfigRequest,
} from "../schemas/config/index.js";
import {
  CurrentConfigResponseSchema,
  InitResponseSchema,
  OpenRouterModelsResponseSchema,
  ProviderModelsResponseSchema,
  ProvidersStatusResponseSchema,
} from "../schemas/config/index.js";
import type { ApiClient } from "./types.js";

export async function getProviderStatus(
  client: ApiClient,
): Promise<ProvidersStatusResponse["providers"]> {
  const response = await client.get<ProvidersStatusResponse>(
    "/api/config/providers",
    undefined,
    (body) => ProvidersStatusResponseSchema.parse(body),
  );
  return response.providers;
}

export async function getOpenRouterModels(client: ApiClient): Promise<OpenRouterModelsResponse> {
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
  return client.get<ProviderModelsResponse>(
    `/api/config/provider/${encodeURIComponent(providerId)}/models`,
    undefined,
    (body) => ProviderModelsResponseSchema.parse(body),
  );
}

export async function saveConfig(client: ApiClient, config: SaveConfigRequest): Promise<void> {
  await client.post("/api/config", config);
}

export async function activateProvider(
  client: ApiClient,
  providerId: string,
  model?: string,
): Promise<ActivateProviderResponse> {
  return client.post<ActivateProviderResponse>(
    `/api/config/provider/${encodeURIComponent(providerId)}/activate`,
    model ? { model } : {},
  );
}

export async function deleteProviderCredentials(
  client: ApiClient,
  providerId: string,
): Promise<DeleteProviderResponse> {
  return client.delete<DeleteProviderResponse>(
    `/api/config/provider/${encodeURIComponent(providerId)}`,
  );
}

export async function loadInit(client: ApiClient): Promise<InitResponse> {
  return client.get<InitResponse>("/api/config/init", undefined, (body) =>
    InitResponseSchema.parse(body),
  );
}

export async function checkConfig(client: ApiClient): Promise<ConfigCheckResponse> {
  return client.get<ConfigCheckResponse>("/api/config/check");
}

export async function getConfig(client: ApiClient): Promise<ConfigResponse> {
  return client.get<ConfigResponse>("/api/config", undefined, (body) =>
    CurrentConfigResponseSchema.parse(body),
  );
}

export const bindConfig = (client: ApiClient) => ({
  getProviderStatus: () => getProviderStatus(client),
  getOpenRouterModels: () => getOpenRouterModels(client),
  getProviderModels: (providerId: string) => getProviderModels(client, providerId),
  saveConfig: (config: SaveConfigRequest) => saveConfig(client, config),
  activateProvider: (providerId: string, model?: string) =>
    activateProvider(client, providerId, model),
  deleteProviderCredentials: (providerId: string) => deleteProviderCredentials(client, providerId),
  loadInit: () => loadInit(client),
  checkConfig: () => checkConfig(client),
  getConfig: () => getConfig(client),
});
