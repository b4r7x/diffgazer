import type { ProjectInfo, ProviderStatus, SettingsConfig } from "../../shared/lib/config-store/index.js";
import type { AIProvider } from "@stargazer/schemas/config";

export interface SaveConfigRequest {
  provider: AIProvider;
  apiKey: string;
  model?: string;
}

export interface ProvidersStatusResponse {
  providers: ProviderStatus[];
  activeProvider?: AIProvider;
}

export interface ConfigCheckResponse {
  configured: boolean;
  config?: { provider: AIProvider; model?: string };
}

export interface ConfigResponse {
  provider: AIProvider;
  model?: string;
}

export interface InitResponse {
  config: { provider: AIProvider; model?: string } | null;
  settings: SettingsConfig;
  providers: ProviderStatus[];
  configured: boolean;
  project: ProjectInfo;
}

export interface ActivateProviderResponse {
  provider: AIProvider;
  model?: string;
}

export interface DeleteProviderResponse {
  deleted: boolean;
  provider: AIProvider;
}

export interface DeleteConfigResponse {
  deleted: boolean;
}
