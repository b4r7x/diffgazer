import { api } from "../../../lib/api.js";
import type { SavedTriageReview, TriageReviewMetadata } from "@repo/schemas/triage-storage";
import type { DrilldownResult } from "@repo/schemas/lens";
import type { Result } from "@repo/core";
import {
  streamTriage as sharedStreamTriage,
  streamTriageWithEvents as sharedStreamTriageWithEvents,
  type StreamTriageRequest,
  type StreamTriageOptions,
  type StreamTriageResult,
  type StreamTriageError,
} from "@repo/api";

export type { StreamTriageRequest, StreamTriageOptions, StreamTriageResult, StreamTriageError };

export async function streamTriage(options: StreamTriageRequest = {}): Promise<Response> {
  return sharedStreamTriage(api(), options);
}

export async function streamTriageWithEvents(
  options: StreamTriageOptions
): Promise<Result<StreamTriageResult, StreamTriageError>> {
  return sharedStreamTriageWithEvents(api(), options);
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
