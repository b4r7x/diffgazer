import type { SavedReview } from "@repo/schemas/review-history";
import type { ApiClient } from "./types.js";

export interface ReviewStatusResponse {
  sessionActive: boolean;
  reviewSaved: boolean;
  isComplete: boolean;
  startedAt?: string;
}

export async function getReview(client: ApiClient, id: string): Promise<{ review: SavedReview }> {
  return client.get<{ review: SavedReview }>(`/reviews/${id}`);
}

export async function getReviewStatus(
  client: ApiClient,
  reviewId: string
): Promise<ReviewStatusResponse> {
  return client.get<ReviewStatusResponse>(`/reviews/${reviewId}/status`);
}

export async function deleteReview(client: ApiClient, id: string): Promise<{ existed: boolean }> {
  return client.delete<{ existed: boolean }>(`/reviews/${id}`);
}
