import { api } from "../../../lib/api.js";
import type { SavedTriageReview, TriageReviewMetadata } from "@repo/schemas/triage-storage";
import type { DrilldownResult, LensId, ProfileId } from "@repo/schemas/lens";

export interface StreamTriageRequest {
  staged?: boolean;
  files?: string[];
  lenses?: LensId[];
  profile?: ProfileId;
  signal?: AbortSignal;
}

export async function streamTriage({
  staged = true,
  files,
  lenses,
  profile,
  signal,
}: StreamTriageRequest = {}): Promise<Response> {
  const params: Record<string, string> = {
    staged: String(staged),
  };
  if (files && files.length > 0) {
    params.files = files.join(",");
  }
  if (lenses && lenses.length > 0) {
    params.lenses = lenses.join(",");
  }
  if (profile) {
    params.profile = profile;
  }

  return api().stream("/triage/stream", { params, signal });
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
