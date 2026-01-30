import { api } from "../../../lib/api.js";
import type {
  AIProvider,
  CurrentConfigResponse,
  ConfigCheckResponse,
  ProvidersStatusResponse,
  OpenRouterModel,
} from "@repo/schemas/config";
import type { SettingsConfig, TrustConfig } from "@repo/schemas/settings";

interface OpenRouterModelsResponse {
  models: OpenRouterModel[];
}

export interface SettingsResponse {
  settings: SettingsConfig;
}

export interface TrustResponse {
  trust: TrustConfig;
}

export interface TrustedProjectsResponse {
  projects: TrustConfig[];
}

export interface TrustRemovedResponse {
  removed: boolean;
}

export const settingsApi = {
  async loadSettings(): Promise<SettingsConfig> {
    const response = await api().get<SettingsResponse>("/settings");
    return response.settings;
  },

  async saveSettings(config: SettingsConfig): Promise<SettingsConfig> {
    const response = await api().post<SettingsResponse>("/settings", config);
    return response.settings;
  },

  async loadTrust(projectId: string): Promise<TrustConfig> {
    const response = await api().get<TrustResponse>("/settings/trust", { projectId });
    return response.trust;
  },

  async saveTrust(config: TrustConfig): Promise<TrustConfig> {
    const response = await api().post<TrustResponse>("/settings/trust", config);
    return response.trust;
  },

  async removeTrust(projectId: string): Promise<boolean> {
    const response = await api().delete<TrustRemovedResponse>(`/settings/trust?projectId=${encodeURIComponent(projectId)}`);
    return response.removed;
  },

  async listTrustedProjects(): Promise<TrustConfig[]> {
    const response = await api().get<TrustedProjectsResponse>("/settings/trust/list");
    return response.projects;
  },

  async checkConfig(): Promise<ConfigCheckResponse> {
    return await api().get<ConfigCheckResponse>("/config/check");
  },

  async loadConfig(): Promise<CurrentConfigResponse> {
    return await api().get<CurrentConfigResponse>("/config");
  },

  async saveConfig(provider: AIProvider, apiKey: string, model?: string): Promise<CurrentConfigResponse> {
    return await api().post<CurrentConfigResponse>("/config", { provider, apiKey, model });
  },

  async deleteConfig(): Promise<void> {
    await api().delete("/config");
  },

  async loadProviderStatus(): Promise<ProvidersStatusResponse> {
    return await api().get<ProvidersStatusResponse>("/config/providers");
  },

  async fetchOpenRouterModels(): Promise<OpenRouterModel[]> {
    const response = await api().get<OpenRouterModelsResponse>("/config/openrouter/models");
    return response.models;
  },
};
