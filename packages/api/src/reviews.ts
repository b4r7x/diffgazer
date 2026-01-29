import type { SavedReview } from "@repo/schemas/review-history";
import type { ApiClient } from "./types.js";

export async function getReview(client: ApiClient, id: string): Promise<{ review: SavedReview }> {
  return client.get<{ review: SavedReview }>(`/reviews/${id}`);
}

export async function deleteReview(client: ApiClient, id: string): Promise<{ existed: boolean }> {
  return client.delete<{ existed: boolean }>(`/reviews/${id}`);
}
