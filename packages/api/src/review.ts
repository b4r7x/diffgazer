import type { Result } from "@stargazer/core/result";
import { ok, err } from "@stargazer/core/result";
import {
  buildReviewQueryParams,
  processReviewStream,
  type StreamReviewRequest,
  type StreamReviewOptions as CoreStreamReviewOptions,
  type StreamReviewResult,
  type StreamReviewError,
} from "@stargazer/core/review";
import { ReviewErrorCode, type ReviewMode } from "@stargazer/schemas/review";
import type {
  ApiClient,
  ApiError,
  ReviewContextResponse,
  ReviewsResponse,
  ReviewResponse,
  DrilldownResponse,
} from "./types.js";

export interface StreamReviewOptions {
  mode?: ReviewMode;
  files?: string[];
  lenses?: string[];
  profile?: string;
  signal?: AbortSignal;
}

export type { StreamReviewRequest, StreamReviewResult, StreamReviewError };
export type { CoreStreamReviewOptions as FullStreamReviewOptions };

export async function streamReview(
  client: ApiClient,
  options: StreamReviewOptions = {}
): Promise<Response> {
  const params: Record<string, string> = {};
  if (options.mode) params.mode = options.mode;
  if (options.files?.length) params.files = options.files.join(",");
  if (options.lenses?.length) params.lenses = options.lenses.join(",");
  if (options.profile) params.profile = options.profile;

  return client.stream("/api/review/stream", { params, signal: options.signal });
}

export async function streamReviewWithEvents(
  client: ApiClient,
  options: CoreStreamReviewOptions
): Promise<Result<StreamReviewResult, StreamReviewError>> {
  const { mode, files, lenses, profile, signal, ...handlers } = options;

  const params = buildReviewQueryParams({ mode, files, lenses, profile });
  const response = await client.stream("/api/review/stream", { params, signal });

  const reader = response.body?.getReader();

  if (!reader) {
    return err({ code: "STREAM_ERROR", message: "No response body" });
  }

  return processReviewStream(reader, handlers);
}

export interface ResumeReviewOptions {
  reviewId: string;
  signal?: AbortSignal;
  onAgentEvent?: CoreStreamReviewOptions["onAgentEvent"];
  onStepEvent?: CoreStreamReviewOptions["onStepEvent"];
  onEnrichEvent?: CoreStreamReviewOptions["onEnrichEvent"];
}

export async function resumeReviewStream(
  client: ApiClient,
  options: ResumeReviewOptions
): Promise<Result<void, StreamReviewError>> {
  const { reviewId, signal, ...handlers } = options;

  let response: Response;
  try {
    response = await client.stream(`/api/review/reviews/${reviewId}/stream`, { signal });
  } catch (error) {
    const status = error instanceof Error && "status" in error ? (error as { status: number }).status : undefined;
    const message = error instanceof Error ? error.message : String(error);
    if (status === 404) {
      return err({ code: ReviewErrorCode.SESSION_NOT_FOUND, message: message || "Session not found" });
    }
    if (status === 409) {
      return err({ code: ReviewErrorCode.SESSION_STALE, message: message || "Session is stale" });
    }
    return err({
      code: "STREAM_ERROR",
      message: message || "Failed to resume review stream",
    });
  }

  const reader = response.body?.getReader();

  if (!reader) {
    return err({ code: "STREAM_ERROR", message: "No response body" });
  }

  const result = await processReviewStream(reader, handlers);

  if (!result.ok) {
    return err(result.error);
  }

  return ok(undefined);
}

export async function getReviews(
  client: ApiClient,
  projectPath?: string
): Promise<ReviewsResponse> {
  const params = projectPath ? { projectPath } : undefined;
  return client.get<ReviewsResponse>("/api/review/reviews", params);
}

export async function getReview(
  client: ApiClient,
  id: string
): Promise<ReviewResponse> {
  return client.get<ReviewResponse>(`/api/review/reviews/${id}`);
}

export async function getReviewContext(
  client: ApiClient
): Promise<ReviewContextResponse> {
  return client.get<ReviewContextResponse>("/api/review/context");
}

export async function refreshReviewContext(
  client: ApiClient,
  options: { force?: boolean } = {}
): Promise<ReviewContextResponse> {
  return client.post<ReviewContextResponse>("/api/review/context/refresh", options);
}

export async function deleteReview(
  client: ApiClient,
  id: string
): Promise<{ existed: boolean }> {
  return client.delete<{ existed: boolean }>(`/api/review/reviews/${id}`);
}

export async function runReviewDrilldown(
  client: ApiClient,
  reviewId: string,
  issueId: string
): Promise<DrilldownResponse> {
  return client.post<DrilldownResponse>(`/api/review/reviews/${reviewId}/drilldown`, {
    issueId,
  });
}

export const bindReview = (client: ApiClient) => ({
  streamReview: (options?: StreamReviewOptions) => streamReview(client, options),
  streamReviewWithEvents: (options: CoreStreamReviewOptions) => streamReviewWithEvents(client, options),
  resumeReviewStream: (options: ResumeReviewOptions) => resumeReviewStream(client, options),
  getReviews: (projectPath?: string) => getReviews(client, projectPath),
  getReview: (id: string) => getReview(client, id),
  getReviewContext: () => getReviewContext(client),
  refreshReviewContext: (options?: { force?: boolean }) => refreshReviewContext(client, options),
  deleteReview: (id: string) => deleteReview(client, id),
  runReviewDrilldown: (reviewId: string, issueId: string) =>
    runReviewDrilldown(client, reviewId, issueId),
});
