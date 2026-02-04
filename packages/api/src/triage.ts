import type { Result } from "@stargazer/core";
import { err } from "@stargazer/core";
import {
  buildTriageQueryParams,
  processTriageStream,
  type StreamTriageRequest,
  type StreamTriageOptions as CoreStreamTriageOptions,
  type StreamTriageResult,
  type StreamTriageError,
} from "@stargazer/core/review";
import type {
  ApiClient,
  ReviewMode,
  TriageReviewsResponse,
  TriageReviewResponse,
  DrilldownResponse,
} from "./types.js";

export interface StreamTriageOptions {
  mode?: ReviewMode;
  staged?: boolean;
  files?: string[];
  lenses?: string[];
  profile?: string;
  signal?: AbortSignal;
}

export type { StreamTriageRequest, StreamTriageResult, StreamTriageError };
export type { CoreStreamTriageOptions as FullStreamTriageOptions };

export async function streamTriage(
  client: ApiClient,
  options: StreamTriageOptions = {}
): Promise<Response> {
  const params: Record<string, string> = {};
  if (options.mode) {
    params.mode = options.mode;
  } else if (options.staged !== undefined) {
    params.staged = String(options.staged);
  }
  if (options.files?.length) params.files = options.files.join(",");
  if (options.lenses?.length) params.lenses = options.lenses.join(",");
  if (options.profile) params.profile = options.profile;

  return client.stream("/api/triage/stream", { params, signal: options.signal });
}

export async function streamTriageWithEvents(
  client: ApiClient,
  options: CoreStreamTriageOptions
): Promise<Result<StreamTriageResult, StreamTriageError>> {
  const { mode, files, lenses, profile, signal, ...handlers } = options;

  const params = buildTriageQueryParams({ mode, files, lenses, profile });
  const response = await client.stream("/api/triage/stream", { params, signal });

  const reader = response.body?.getReader();

  if (!reader) {
    return err({ code: "STREAM_ERROR", message: "No response body" });
  }

  return processTriageStream(reader, handlers);
}

export interface ResumeTriageOptions {
  reviewId: string;
  signal?: AbortSignal;
  onAgentEvent?: CoreStreamTriageOptions["onAgentEvent"];
  onStepEvent?: CoreStreamTriageOptions["onStepEvent"];
}

export async function resumeTriageStream(
  client: ApiClient,
  options: ResumeTriageOptions
): Promise<Result<void, StreamTriageError>> {
  const { reviewId, signal, ...handlers } = options;

  const response = await client.stream(`/api/reviews/${reviewId}/stream`, { signal });

  if (!response.ok) {
    return err({ code: "NOT_FOUND", message: "Session not found" });
  }

  const reader = response.body?.getReader();

  if (!reader) {
    return err({ code: "STREAM_ERROR", message: "No response body" });
  }

  const result = await processTriageStream(reader, handlers);

  if (!result.ok) {
    return err(result.error);
  }

  return { ok: true, value: undefined };
}

export async function getTriageReviews(
  client: ApiClient,
  projectPath?: string
): Promise<TriageReviewsResponse> {
  const params = projectPath ? { projectPath } : undefined;
  return client.get<TriageReviewsResponse>("/api/triage/reviews", params);
}

export async function getTriageReview(
  client: ApiClient,
  id: string
): Promise<TriageReviewResponse> {
  return client.get<TriageReviewResponse>(`/api/triage/reviews/${id}`);
}

export async function deleteTriageReview(
  client: ApiClient,
  id: string
): Promise<{ existed: boolean }> {
  return client.delete<{ existed: boolean }>(`/api/triage/reviews/${id}`);
}

export async function runTriageDrilldown(
  client: ApiClient,
  reviewId: string,
  issueId: string
): Promise<DrilldownResponse> {
  return client.post<DrilldownResponse>(`/api/triage/reviews/${reviewId}/drilldown`, {
    issueId,
  });
}

export const bindTriage = (client: ApiClient) => ({
  streamTriage: (options?: StreamTriageOptions) => streamTriage(client, options),
  streamTriageWithEvents: (options: CoreStreamTriageOptions) => streamTriageWithEvents(client, options),
  resumeTriageStream: (options: ResumeTriageOptions) => resumeTriageStream(client, options),
  getTriageReviews: (projectPath?: string) => getTriageReviews(client, projectPath),
  getTriageReview: (id: string) => getTriageReview(client, id),
  deleteTriageReview: (id: string) => deleteTriageReview(client, id),
  runTriageDrilldown: (reviewId: string, issueId: string) =>
    runTriageDrilldown(client, reviewId, issueId),
});
