import type { AIProvider, ProviderStatus, SettingsConfig, TrustConfig } from "@/types/config";

export interface SaveConfigRequest {
  provider: AIProvider;
  apiKey: string;
  model?: string;
}

export interface ProvidersStatusResponse {
  providers: ProviderStatus[];
  activeProvider?: AIProvider;
}

export interface ProjectInfo {
  path: string;
  projectId: string;
  trust: TrustConfig | null;
}

export interface InitResponse {
  config: { provider: AIProvider; model?: string } | null;
  settings: SettingsConfig;
  providers: ProviderStatus[];
  configured: boolean;
  project: ProjectInfo;
}
