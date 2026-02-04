export interface ApiError extends Error {
  status: number;
  code?: string;
}

export interface StreamOptions {
  body?: unknown;
  params?: Record<string, string>;
  signal?: AbortSignal;
}

export interface ApiClientConfig {
  baseUrl: string;
  projectRoot?: string;
  headers?: Record<string, string>;
}

export interface ApiClient {
  get: <T>(path: string, params?: Record<string, string>) => Promise<T>;
  post: <T>(path: string, body?: unknown) => Promise<T>;
  put: <T>(path: string, body?: unknown) => Promise<T>;
  delete: <T>(path: string) => Promise<T>;
  stream: (path: string, options?: StreamOptions) => Promise<Response>;
  request: (
    method: string,
    path: string,
    options?: { body?: unknown; params?: Record<string, string>; signal?: AbortSignal }
  ) => Promise<Response>;
}

export type AIProvider =
  | "gemini"
  | "openai"
  | "anthropic"
  | "glm"
  | "openrouter"
  | (string & {});

export interface ProviderStatus {
  provider: AIProvider;
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

export type Theme = "auto" | "dark" | "light" | "terminal";
export type SecretsStorage = "file" | "keyring";

export interface SettingsConfig {
  theme: Theme;
  defaultLenses?: string[];
  defaultProfile?: string | null;
  severityThreshold?: string;
  secretsStorage?: SecretsStorage | null;
}

export interface SaveConfigRequest {
  provider: AIProvider;
  apiKey: string;
  model?: string;
}

export interface ProvidersStatusResponse {
  providers: ProviderStatus[];
  activeProvider?: AIProvider;
}

export interface InitResponse {
  config: { provider: AIProvider; model?: string } | null;
  settings: SettingsConfig;
  providers: ProviderStatus[];
  configured: boolean;
  project: ProjectInfo;
}

export interface ReviewHistoryMetadata {
  id: string;
  issueCount: number;
  projectPath?: string;
  createdAt?: string;
  staged?: boolean;
  branch?: string | null;
  overallScore?: number;
  criticalCount?: number;
  warningCount?: number;
}

export interface SavedReview {
  metadata: ReviewHistoryMetadata;
  result: unknown;
  gitContext?: unknown;
}
