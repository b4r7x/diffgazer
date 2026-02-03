import type { ProjectInfo, ProviderStatus, SettingsConfig } from "../../shared/lib/config-store.js";

export interface SaveConfigRequest {
  provider: string;
  apiKey: string;
  model?: string;
}

export interface ProvidersStatusResponse {
  providers: ProviderStatus[];
  activeProvider?: string;
}

export interface InitResponse {
  config: { provider: string; model?: string } | null;
  settings: SettingsConfig;
  providers: ProviderStatus[];
  configured: boolean;
  project: ProjectInfo;
}

export interface ActivateProviderResponse {
  provider: string;
  model?: string;
}

export interface DeleteProviderResponse {
  deleted: boolean;
  provider: string;
}
