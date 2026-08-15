import { z } from "zod";
import { getErrorMessage } from "../errors.js";
import type { Result } from "../result.js";
import { err, ok } from "../result.js";
import {
  type StreamReviewOptions as CoreStreamReviewOptions,
  processReviewStream,
  type StreamReviewError,
} from "../review/stream.js";
import {
  MAX_CONTEXT_GRAPH_JSON_BYTES,
  MAX_CONTEXT_MARKDOWN_BYTES,
  MAX_CONTEXT_META_JSON_BYTES,
  ReviewContextResponseSchema,
} from "../schemas/context.js";
import { ErrorCode } from "../schemas/errors.js";
import {
  type ActiveReviewSessionResponse,
  ActiveReviewSessionResponseSchema,
  type CreateReviewResponse,
  CreateReviewResponseSchema,
  type LensId,
  MAX_REVIEW_ISSUES,
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

/**
 * `text` and `markdown` each carry the writer's markdown cap and can double under
 * JSON string escaping; `graph` and `meta` ship inside their own serialized bounds.
 */
export const REVIEW_CONTEXT_RESPONSE_MAX_BYTES =
  MAX_CONTEXT_MARKDOWN_BYTES * 4 + MAX_CONTEXT_GRAPH_JSON_BYTES + MAX_CONTEXT_META_JSON_BYTES;

/** Every storable issue at the size of one carrying a patch and evidence, plus the review envelope. */
const SAVED_REVIEW_RESPONSE_MAX_BYTES = MAX_REVIEW_ISSUES * 4 * 1_024 + 64 * 1_024;

/** One page of metadata rows plus the salvage warnings a bootstrap scan reports for the whole store. */
export const REVIEWS_LIST_RESPONSE_MAX_BYTES = 512 * 1_024;

export type { StreamReviewError };

interface CreateReviewSelection {
  lenses?: LensId[];
  profile?: ProfileId;
}

/**
 * `mode: "files"` is the one mode the server rejects without a non-empty
 * `files[]`, so the two states are modelled as separate arms rather than as
 * independent optionals that can contradict each other.
 */
export type CreateReviewOptions =
  | (CreateReviewSelection & { mode?: Exclude<ReviewMode, "files">; files?: string[] })
  | (CreateReviewSelection & { mode: "files"; files: [string, ...string[]] });

export type CancelReason = "cancelled" | "not-found" | "already-complete" | "already-committed";

export interface CancelReviewSessionResponse {
  cancelled: true;
  reason: CancelReason;
}

const CancelReviewSessionResponseSchema = z.object({
  cancelled: z.literal(true),
  reason: z.enum(["cancelled", "not-found", "already-complete", "already-committed"]),
});

export function createReview(
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
    if (status === 403 && isApiError(error) && error.code === ErrorCode.TRUST_REQUIRED) {
      return err({
        code: ReviewErrorCode.TRUST_REQUIRED,
        message: message || "Repository access not granted",
      });
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
  } finally {
    // This function acquired the reader, so it owns the teardown: a caller
    // handler that throws must not leave the SSE connection open and the body
    // locked until GC. Cancelling an already-closed stream is a no-op; an
    // errored one rejects, which must not mask the result being returned.
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }

  if (!streamResult.ok) {
    return err(streamResult.error);
  }

  return ok({
    result: streamResult.value.result,
    reviewId: streamResult.value.reviewId,
  });
}

export function getReviews(
  client: ApiClient,
  cursor?: ReviewCursor,
  signal?: AbortSignal,
): Promise<ReviewsResponse> {
  return client.get<ReviewsResponse>("/api/review/reviews", {
    maxResponseBytes: REVIEWS_LIST_RESPONSE_MAX_BYTES,
    params: cursor ? { cursor } : {},
    signal,
    schema: (body) => ReviewsResponseSchema.parse(body),
  });
}

function getReview(client: ApiClient, id: string, signal?: AbortSignal): Promise<ReviewResponse> {
  return client.get<ReviewResponse>(`/api/review/reviews/${id}`, {
    maxResponseBytes: SAVED_REVIEW_RESPONSE_MAX_BYTES,
    signal,
    schema: (body) => ReviewResponseSchema.parse(body),
  });
}

export function getActiveReviewSession(
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

export function getReviewContext(
  client: ApiClient,
  signal?: AbortSignal,
): Promise<ReviewContextResponse> {
  return client.get<ReviewContextResponse>("/api/review/context", {
    maxResponseBytes: REVIEW_CONTEXT_RESPONSE_MAX_BYTES,
    signal,
    schema: (body) => ReviewContextResponseSchema.parse(body),
  });
}

export function refreshReviewContext(
  client: ApiClient,
  options: { force?: boolean } = {},
): Promise<ReviewContextResponse> {
  return client.post<ReviewContextResponse>("/api/review/context/refresh", options, {
    maxResponseBytes: REVIEW_CONTEXT_RESPONSE_MAX_BYTES,
    schema: (body) => ReviewContextResponseSchema.parse(body),
  });
}

function cancelReviewSession(
  client: ApiClient,
  reviewId: string,
): Promise<CancelReviewSessionResponse> {
  return client.delete<CancelReviewSessionResponse>(`/api/review/sessions/${reviewId}`, {
    schema: (body) => CancelReviewSessionResponseSchema.parse(body),
  });
}

export const bindReview = (client: ApiClient) => ({
  createReview: (options?: CreateReviewOptions) => createReview(client, options),
  resumeReviewStream: (options: ResumeReviewOptions) => resumeReviewStream(client, options),
  getReviews: (cursor?: ReviewCursor, signal?: AbortSignal) => getReviews(client, cursor, signal),
  getReview: (id: string, signal?: AbortSignal) => getReview(client, id, signal),
  getActiveReviewSession: (mode?: ReviewMode, signal?: AbortSignal) =>
    getActiveReviewSession(client, mode, signal),
  getReviewContext: (signal?: AbortSignal) => getReviewContext(client, signal),
  refreshReviewContext: (options?: { force?: boolean }) => refreshReviewContext(client, options),
  cancelReviewSession: (reviewId: string) => cancelReviewSession(client, reviewId),
});
