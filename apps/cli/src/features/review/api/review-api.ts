import { api } from "../../../lib/api.js";
import type { SavedReview, ReviewHistoryMetadata } from "@repo/schemas/review-history";

export interface StreamReviewRequest {
  staged?: boolean;
  signal?: AbortSignal;
}

export async function streamReview({ staged = true, signal }: StreamReviewRequest = {}): Promise<Response> {
  return api().stream("/review/stream", {
    params: { staged: String(staged) },
    signal,
  });
}

export interface GetReviewHistoryRequest {
  projectPath: string;
}

export interface ReviewListResponse {
  reviews: ReviewHistoryMetadata[];
  warnings?: string[];
}

export async function getReviewHistory({ projectPath }: GetReviewHistoryRequest): Promise<ReviewListResponse> {
  return api().get<ReviewListResponse>(`/reviews?projectPath=${encodeURIComponent(projectPath)}`);
}

export async function getReview(id: string): Promise<{ review: SavedReview }> {
  return api().get<{ review: SavedReview }>(`/reviews/${id}`);
}

export async function deleteReview(id: string): Promise<{ existed: boolean }> {
  return api().delete<{ existed: boolean }>(`/reviews/${id}`);
}
