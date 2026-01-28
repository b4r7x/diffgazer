import { api } from "@/lib/api";
import type { SavedReview, ReviewHistoryMetadata } from "@repo/schemas";

export async function getReviewHistory(): Promise<ReviewHistoryMetadata[]> {
  return api.get<ReviewHistoryMetadata[]>("/reviews");
}

export async function getReview(id: string): Promise<{ review: SavedReview }> {
  return api.get<{ review: SavedReview }>(`/reviews/${id}`);
}

export async function deleteReview(id: string): Promise<{ existed: boolean }> {
  return api.delete<{ existed: boolean }>(`/reviews/${id}`);
}
