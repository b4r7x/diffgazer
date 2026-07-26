import { getErrorMessage } from "../errors.js";
import type { Result } from "../result.js";
import { err, ok } from "../result.js";
import {
  type StreamReviewOptions as CoreStreamReviewOptions,
  processReviewStream,
  type StreamReviewError,
} from "../review/stream.js";
import {
  type ActiveReviewSessionResponse,
  ActiveReviewSessionResponseSchema,
  type CreateReviewResponse,
  CreateReviewResponseSchema,
  type LensId,
  type ProfileId,
  type ReviewCursor,
  ReviewErrorCode,
  type ReviewMode,
  type ReviewResponse,
  ReviewResponseSchema,
  type ReviewsResponse,
  ReviewsResponseSchema,
} from "../schemas/review/index.js";
import { type ApiClient, isApiError, type ReviewContextResponse } from "./types.js";

export type { StreamReviewError };

export interface CreateReviewOptions {
  mode?: ReviewMode;
  lenses?: LensId[];
  profile?: ProfileId;
  files?: string[];
}

export type CancelReason = "cancelled" | "not-found" | "already-complete" | "already-committed";

export interface CancelReviewSessionResponse {
  cancelled: true;
  reason: CancelReason;
}

export async function createReview(
  client: ApiClient,
  options: CreateReviewOptions = {},
): Promise<CreateReviewResponse> {
  return client.post<CreateReviewResponse>("/api/review/reviews", options, {
    schema: (body) => CreateReviewResponseSchema.parse(body),
  });
}

export interface ResumeReviewOptions {
  reviewId: string;
  signal?: AbortSignal;
  onAgentEvent?: CoreStreamReviewOptions["onAgentEvent"];
  onStepEvent?: CoreStreamReviewOptions["onStepEvent"];
  onChunk?: CoreStreamReviewOptions["onChunk"];
}

export interface ResumeReviewResult {
  result: import("../schemas/review/index.js").ReviewResult;
  reviewId: string;
}

export async function resumeReviewStream(
  client: ApiClient,
  options: ResumeReviewOptions,
): Promise<Result<ResumeReviewResult, StreamReviewError>> {
  const { reviewId, signal, ...handlers } = options;

  let response: Response;
  try {
    response = await client.request("GET", `/api/review/reviews/${reviewId}/stream`, { signal });
  } catch (error) {
    const status = isApiError(error) ? error.status : undefined;
    const message = getErrorMessage(error);
    if (status === 404) {
      return err({
        code: ReviewErrorCode.SESSION_NOT_FOUND,
        message: message || "Session not found",
      });
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

  let streamResult: Awaited<ReturnType<typeof processReviewStream>>;
  try {
    // A mid-stream reader failure rejects; honor the Result contract instead of
    // letting the rejection escape the typed Promise.
    streamResult = await processReviewStream(reader, handlers);
  } catch (error) {
    return err({
      code: "STREAM_ERROR",
      message: getErrorMessage(error) || "Review stream failed",
    });
  }

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
  projectPath?: string,
  cursor?: ReviewCursor,
  limit?: number,
): Promise<ReviewsResponse> {
  const params = {
    ...(projectPath ? { projectPath } : {}),
    ...(cursor ? { cursor } : {}),
    ...(limit !== undefined ? { limit: String(limit) } : {}),
  };
  return client.get<ReviewsResponse>("/api/review/reviews", {
    params,
    schema: (body) => ReviewsResponseSchema.parse(body),
  });
}

export async function getReview(client: ApiClient, id: string): Promise<ReviewResponse> {
  return client.get<ReviewResponse>(`/api/review/reviews/${id}`, {
    schema: (body) => ReviewResponseSchema.parse(body),
  });
}

export async function getActiveReviewSession(
  client: ApiClient,
  mode?: ReviewMode,
  signal?: AbortSignal,
): Promise<ActiveReviewSessionResponse> {
  return client.get<ActiveReviewSessionResponse>("/api/review/sessions/active", {
    ...(mode ? { params: { mode } } : {}),
    ...(signal ? { signal } : {}),
    schema: (body) => ActiveReviewSessionResponseSchema.parse(body),
  });
}

export async function getReviewContext(client: ApiClient): Promise<ReviewContextResponse> {
  return client.get<ReviewContextResponse>("/api/review/context");
}

export async function refreshReviewContext(
  client: ApiClient,
  options: { force?: boolean } = {},
): Promise<ReviewContextResponse> {
  return client.post<ReviewContextResponse>("/api/review/context/refresh", options);
}

export async function cancelReviewSession(
  client: ApiClient,
  reviewId: string,
): Promise<CancelReviewSessionResponse> {
  return client.delete<CancelReviewSessionResponse>(`/api/review/sessions/${reviewId}`);
}

export const bindReview = (client: ApiClient) => ({
  createReview: (options?: CreateReviewOptions) => createReview(client, options),
  resumeReviewStream: (options: ResumeReviewOptions) => resumeReviewStream(client, options),
  getReviews: (projectPath?: string, cursor?: ReviewCursor, limit?: number) =>
    getReviews(client, projectPath, cursor, limit),
  getReview: (id: string) => getReview(client, id),
  getActiveReviewSession: (mode?: ReviewMode, signal?: AbortSignal) =>
    getActiveReviewSession(client, mode, signal),
  getReviewContext: () => getReviewContext(client),
  refreshReviewContext: (options?: { force?: boolean }) => refreshReviewContext(client, options),
  cancelReviewSession: (reviewId: string) => cancelReviewSession(client, reviewId),
});
