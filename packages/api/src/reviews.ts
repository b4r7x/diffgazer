import type { ApiClient, ReviewHistoryMetadata, SavedReview } from "./types.js";

export async function getReviewHistory(client: ApiClient): Promise<ReviewHistoryMetadata[]> {
  return client.get<ReviewHistoryMetadata[]>("/api/reviews");
}

export async function getReview(client: ApiClient, id: string): Promise<{ review: SavedReview }> {
  return client.get<{ review: SavedReview }>(`/api/reviews/${id}`);
}

export async function deleteReview(client: ApiClient, id: string): Promise<{ deleted: boolean }> {
  return client.delete<{ deleted: boolean }>(`/api/reviews/${id}`);
}

export const bindReviews = (client: ApiClient) => ({
  getReviewHistory: () => getReviewHistory(client),
  getReview: (id: string) => getReview(client, id),
  deleteReview: (id: string) => deleteReview(client, id),
});
