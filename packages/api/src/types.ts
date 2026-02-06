import type { TrustConfig } from "@stargazer/schemas/config";
import type {
  ReviewMode,
  ReviewMetadata,
  SavedReview,
  DrilldownResult,
} from "@stargazer/schemas/review";
import type { ProjectContextGraph, ProjectContextMeta } from "@stargazer/schemas/context";

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
  trust: TrustConfig;
}

export interface TrustListResponse {
  projects: TrustConfig[];
}

export interface ReviewContextResponse {
  text: string;
  markdown: string;
  graph: ProjectContextGraph;
  meta: ProjectContextMeta;
}

export interface GitDiffResponse {
  diff: string;
  mode: ReviewMode;
}

export interface ReviewsResponse {
  reviews: ReviewMetadata[];
  warnings?: string[];
}

export interface ReviewResponse {
  review: SavedReview;
}

export interface DrilldownResponse {
  drilldown: DrilldownResult;
}
