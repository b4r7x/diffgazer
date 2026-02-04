export type Theme = "auto" | "dark" | "light" | "terminal";

export type SecretsStorage = "file" | "keyring";

export interface SettingsConfig {
  theme: Theme;
  defaultLenses?: string[];
  defaultProfile?: string | null;
  severityThreshold?: string;
  secretsStorage?: SecretsStorage | null;
}

export interface ProviderStatus {
  provider: string;
  hasApiKey: boolean;
  isActive: boolean;
  model?: string;
  mode?: string;
}

export interface TrustCapabilities {
  readFiles: boolean;
  readGit: boolean;
  runCommands: boolean;
}

export type TrustMode = "persistent" | "session";

export interface TrustConfig {
  projectId: string;
  repoRoot: string;
  trustedAt: string;
  capabilities: TrustCapabilities;
  trustMode: TrustMode;
}

export interface ProjectInfo {
  path: string;
  projectId: string;
  trust: TrustConfig | null;
}

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
