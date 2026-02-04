import type { ApiClient, ReviewHistoryMetadata, ReviewStreamStatus, SavedReview } from "./types.js";

export async function getReviewHistory(client: ApiClient): Promise<ReviewHistoryMetadata[]> {
  return client.get<ReviewHistoryMetadata[]>("/api/reviews");
}

export async function getReview(client: ApiClient, id: string): Promise<{ review: SavedReview }> {
  return client.get<{ review: SavedReview }>(`/api/reviews/${id}`);
}

export async function deleteReview(client: ApiClient, id: string): Promise<{ deleted: boolean }> {
  return client.delete<{ deleted: boolean }>(`/api/reviews/${id}`);
}

export async function streamReviewSession(
  client: ApiClient,
  id: string,
  options: { signal?: AbortSignal } = {}
): Promise<Response> {
  return client.stream(`/api/reviews/${id}/stream`, { signal: options.signal });
}

export async function getReviewStatus(
  client: ApiClient,
  id: string
): Promise<ReviewStreamStatus> {
  return client.get<ReviewStreamStatus>(`/api/reviews/${id}/status`);
}

export const bindReviews = (client: ApiClient) => ({
  getReviewHistory: () => getReviewHistory(client),
  getReview: (id: string) => getReview(client, id),
  deleteReview: (id: string) => deleteReview(client, id),
  streamReviewSession: (id: string, options?: { signal?: AbortSignal }) =>
    streamReviewSession(client, id, options),
  getReviewStatus: (id: string) => getReviewStatus(client, id),
});
