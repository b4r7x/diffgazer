import type { Result } from "@diffgazer/core/result";
import { ok, err } from "@diffgazer/core/result";
import {
  processReviewStream,
  type StreamReviewOptions as CoreStreamReviewOptions,
  type StreamReviewError,
} from "@diffgazer/core/review";
import { ReviewErrorCode, type ReviewMode } from "@diffgazer/core/schemas/review";
import type {
  ApiClient,
  ActiveReviewSessionResponse,
  ReviewContextResponse,
  ReviewsResponse,
  ReviewResponse,
  DrilldownResponse,
} from "./types.js";

export type { StreamReviewError };

export interface CreateReviewOptions {
  mode?: ReviewMode;
  lenses?: string[];
  profile?: string;
  files?: string[];
}

export interface CreateReviewResponse {
  reviewId: string;
}

export async function createReview(
  client: ApiClient,
  options: CreateReviewOptions = {},
): Promise<CreateReviewResponse> {
  return client.post<CreateReviewResponse>("/api/review/reviews", options);
}

export interface ResumeReviewOptions {
  reviewId: string;
  signal?: AbortSignal;
  onAgentEvent?: CoreStreamReviewOptions["onAgentEvent"];
  onStepEvent?: CoreStreamReviewOptions["onStepEvent"];
  onEnrichEvent?: CoreStreamReviewOptions["onEnrichEvent"];
}

export interface ResumeReviewResult {
  result: import("@diffgazer/core/schemas/review").ReviewResult;
  reviewId: string;
}

export async function resumeReviewStream(
  client: ApiClient,
  options: ResumeReviewOptions
): Promise<Result<ResumeReviewResult, StreamReviewError>> {
  const { reviewId, signal, ...handlers } = options;

  let response: Response;
  try {
    response = await client.request("GET", `/api/review/reviews/${reviewId}/stream`, { signal });
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

  const streamResult = await processReviewStream(reader, handlers);

  if (!streamResult.ok) {
    return err(streamResult.error);
  }

  return ok({
    result: streamResult.value.result,
    reviewId: streamResult.value.reviewId,
  });
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

export async function getActiveReviewSession(
  client: ApiClient,
  mode?: ReviewMode,
): Promise<ActiveReviewSessionResponse> {
  return client.get<ActiveReviewSessionResponse>(
    "/api/review/sessions/active",
    mode ? { mode } : undefined,
  );
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

export async function cancelReviewSession(
  client: ApiClient,
  reviewId: string,
): Promise<{ cancelled: boolean }> {
  return client.delete<{ cancelled: boolean }>(`/api/review/sessions/${reviewId}`);
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
  createReview: (options?: CreateReviewOptions) => createReview(client, options),
  resumeReviewStream: (options: ResumeReviewOptions) => resumeReviewStream(client, options),
  getReviews: (projectPath?: string) => getReviews(client, projectPath),
  getReview: (id: string) => getReview(client, id),
  getActiveReviewSession: (mode?: ReviewMode) => getActiveReviewSession(client, mode),
  getReviewContext: () => getReviewContext(client),
  refreshReviewContext: (options?: { force?: boolean }) => refreshReviewContext(client, options),
  deleteReview: (id: string) => deleteReview(client, id),
  cancelReviewSession: (reviewId: string) => cancelReviewSession(client, reviewId),
  runReviewDrilldown: (reviewId: string, issueId: string) =>
    runReviewDrilldown(client, reviewId, issueId),
});
