export type {
  ProjectInfo,
  ProviderStatus,
  SecretsStorage,
  SettingsConfig,
  Theme,
  TrustCapabilities,
  TrustConfig,
  TrustMode,
} from "@stargazer/api";

export interface ConfigState {
  settings: SettingsConfig;
  providers: ProviderStatus[];
}

export interface SecretsState {
  providers: Record<string, string>;
}

export interface TrustState {
  projects: Record<string, TrustConfig>;
}

export interface ProjectFile {
  projectId: string;
  repoRoot: string;
  createdAt: string;
}
