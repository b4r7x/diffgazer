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

export interface TrustResponse {
  trust: TrustConfig;
}

export interface TrustListResponse {
  projects: TrustConfig[];
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

export interface ConfigCheckResponse {
  configured: boolean;
  config?: { provider: AIProvider; model?: string };
}

export interface ConfigResponse {
  provider: AIProvider;
  model?: string;
}

export interface DeleteConfigResponse {
  deleted: boolean;
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

export type GitDiffMode = "staged" | "unstaged" | "files";

export interface GitFileEntry {
  path: string;
  indexStatus: string;
  workTreeStatus: string;
}

export interface GitStatus {
  isGitRepo: boolean;
  branch: string | null;
  remoteBranch: string | null;
  ahead: number;
  behind: number;
  files: {
    staged: GitFileEntry[];
    unstaged: GitFileEntry[];
    untracked: GitFileEntry[];
  };
  hasChanges: boolean;
  conflicted: string[];
}

export interface GitDiffResponse {
  diff: string;
  mode: GitDiffMode;
}

export type MessageRole = "user" | "assistant" | "system";

export interface SessionMessage {
  id: string;
  role: MessageRole;
  content: string;
  createdAt: string;
}

export interface SessionMetadata {
  id: string;
  projectPath: string;
  title?: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
}

export interface Session {
  metadata: SessionMetadata;
  messages: SessionMessage[];
}

export interface SessionsListResponse {
  sessions: SessionMetadata[];
  warnings?: string[];
}

export interface SessionResponse {
  session: Session;
}

export interface SessionMessageResponse {
  message: SessionMessage;
}

export interface SessionDeleteResponse {
  existed: boolean;
}

export type ReviewMode = "staged" | "unstaged" | "files";

export interface TriageReviewMetadata {
  id: string;
  projectPath: string;
  createdAt: string;
  mode: ReviewMode;
  branch: string | null;
  profile: string | null;
  lenses: string[];
  issueCount: number;
  blockerCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  nitCount: number;
  fileCount: number;
  durationMs?: number;
}

export interface SavedTriageReview {
  metadata: TriageReviewMetadata;
  result: unknown;
  gitContext?: unknown;
  drilldowns?: unknown[];
}

export interface TriageReviewsResponse {
  reviews: TriageReviewMetadata[];
  warnings?: string[];
}

export interface TriageReviewResponse {
  review: SavedTriageReview;
}

export interface DrilldownResponse {
  drilldown: unknown;
}

export interface ReviewStreamStatus {
  sessionActive: boolean;
  reviewSaved: boolean;
  isComplete: boolean;
  startedAt?: string;
}

export interface PRReviewResponse {
  summary: string;
  issues: Array<{
    severity: string;
    title: string;
    file: string;
    line: number;
    message: string;
    suggestion?: string;
  }>;
  annotations: Array<{
    path: string;
    start_line: number;
    end_line: number;
    annotation_level: "notice" | "warning" | "failure";
    message: string;
    title: string;
  }>;
  inlineComments: Array<{
    path: string;
    line: number;
    side: "RIGHT";
    body: string;
  }>;
}
