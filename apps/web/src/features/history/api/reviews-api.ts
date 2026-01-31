import { api } from "@/lib/api";
import type { ReviewHistoryMetadata } from "@repo/schemas";
import { deleteReview as sharedDeleteReview } from "@repo/api";

interface ListReviewsResponse {
  reviews: ReviewHistoryMetadata[];
  warnings?: string[];
}

export async function getReviews(projectPath?: string): Promise<ReviewHistoryMetadata[]> {
  const params = projectPath ? { projectPath } : undefined;
  const response = await api.get<ListReviewsResponse>("/reviews", params);
  return response.reviews;
}

export async function deleteReview(id: string) {
  return sharedDeleteReview(api, id);
}
