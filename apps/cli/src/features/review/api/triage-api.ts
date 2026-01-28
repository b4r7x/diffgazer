import { api } from "../../../lib/api.js";
import type { SavedTriageReview, TriageReviewMetadata } from "@repo/schemas/triage-storage";
import type { DrilldownResult } from "@repo/schemas/lens";
import type { Result } from "@repo/core";
import {
  buildTriageQueryParams,
  processTriageStream,
  type StreamTriageRequest,
  type StreamTriageOptions,
  type StreamTriageResult,
  type StreamTriageError,
} from "@repo/core/review";
import { err } from "@repo/core";

export type { StreamTriageRequest, StreamTriageOptions, StreamTriageResult, StreamTriageError };

export async function streamTriage({
  staged = true,
  files,
  lenses,
  profile,
  signal,
}: StreamTriageRequest = {}): Promise<Response> {
  const params = buildTriageQueryParams({ staged, files, lenses, profile });
  return api().stream("/triage/stream", { params, signal });
}

export async function streamTriageWithEvents(
  options: StreamTriageOptions
): Promise<Result<StreamTriageResult, StreamTriageError>> {
  const { staged, files, lenses, profile, signal, ...handlers } = options;

  const response = await streamTriage({ staged, files, lenses, profile, signal });
  const reader = response.body?.getReader();

  if (!reader) {
    return err({ code: "STREAM_ERROR", message: "No response body" });
  }

  return processTriageStream(reader, handlers);
}

export interface GetTriageReviewsRequest {
  projectPath: string;
}

export interface TriageReviewListResponse {
  reviews: TriageReviewMetadata[];
  warnings?: string[];
}

export async function getTriageReviews({
  projectPath,
}: GetTriageReviewsRequest): Promise<TriageReviewListResponse> {
  return api().get<TriageReviewListResponse>(
    `/triage/reviews?projectPath=${encodeURIComponent(projectPath)}`
  );
}

export async function getTriageReview(id: string): Promise<{ review: SavedTriageReview }> {
  return api().get<{ review: SavedTriageReview }>(`/triage/reviews/${id}`);
}

export async function deleteTriageReview(id: string): Promise<{ existed: boolean }> {
  return api().delete<{ existed: boolean }>(`/triage/reviews/${id}`);
}

export interface TriggerDrilldownRequest {
  reviewId: string;
  issueId: string;
}

export async function triggerDrilldown({
  reviewId,
  issueId,
}: TriggerDrilldownRequest): Promise<{ drilldown: DrilldownResult }> {
  return api().post<{ drilldown: DrilldownResult }>(
    `/triage/reviews/${reviewId}/drilldown`,
    { issueId }
  );
}
