// Import shared types from schemas for local use
import type {
  AIProvider as _AIProvider,
  ProviderStatus as _ProviderStatus,
} from "@stargazer/schemas/config";
import type { TrustConfig as _TrustConfig } from "@stargazer/schemas/settings";
import type {
  ReviewMode as _ReviewMode,
  ReviewMetadata as _ReviewMetadata,
  SavedReview as _SavedReview,
} from "@stargazer/schemas/review-storage";

// Re-export shared types from schemas (single source of truth)
export type {
  AIProvider,
  ProviderStatus,
  OpenRouterModel,
  OpenRouterModelsResponse,
  ProvidersStatusResponse,
  ConfigCheckResponse,
  SaveConfigRequest,
  DeleteConfigResponse,
  DeleteProviderCredentialsResponse as DeleteProviderResponse,
  CurrentConfigResponse as ConfigResponse,
  ProjectInfo,
  InitResponse,
} from "@stargazer/schemas/config";

export type {
  TrustCapabilities,
  TrustMode,
  TrustConfig,
  Theme,
  SecretsStorage,
  SettingsConfig,
} from "@stargazer/schemas/settings";

export type {
  ReviewMode,
  ReviewMetadata,
  SavedReview,
} from "@stargazer/schemas/review-storage";

export type { GitFileEntry, GitStatus } from "@stargazer/schemas/git";

// API client types (unique to this package)
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

// API response types (unique to this package - server response shapes)
export interface TrustResponse {
  trust: _TrustConfig;
}

export interface TrustListResponse {
  projects: _TrustConfig[];
}

export interface ActivateProviderResponse {
  provider: _AIProvider;
  model?: string;
}

export type {
  FileTreeNode,
  ProjectContextGraph,
  ProjectContextMeta,
  ProjectContextSnapshot,
} from "@stargazer/schemas/context";

import type { ProjectContextGraph, ProjectContextMeta } from "@stargazer/schemas/context";

export interface ReviewContextResponse {
  text: string;
  markdown: string;
  graph: ProjectContextGraph;
  meta: ProjectContextMeta;
}

export interface GitDiffResponse {
  diff: string;
  mode: _ReviewMode;
}

export interface ReviewsResponse {
  reviews: _ReviewMetadata[];
  warnings?: string[];
}

export interface ReviewResponse {
  review: _SavedReview;
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

