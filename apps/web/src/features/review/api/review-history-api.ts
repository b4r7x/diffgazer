import { api } from "@/lib/api";
import type { SavedReview, ReviewHistoryMetadata } from "@repo/schemas";

export async function getReviewHistory(): Promise<ReviewHistoryMetadata[]> {
  return api.get<ReviewHistoryMetadata[]>("/reviews");
}

export async function getReview(id: string): Promise<SavedReview> {
  return api.get<SavedReview>(`/reviews/${id}`);
}

export async function deleteReview(id: string): Promise<void> {
  return api.delete(`/reviews/${id}`);
}
