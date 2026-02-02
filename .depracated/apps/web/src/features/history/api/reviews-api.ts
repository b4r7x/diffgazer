import { api } from "@/lib/api";
import type { TriageReviewMetadata } from "@repo/schemas/triage-storage";
import { deleteReview as sharedDeleteReview } from "@repo/api";

export async function getReviews(projectPath?: string): Promise<TriageReviewMetadata[]> {
  const params = projectPath ? { projectPath } : undefined;
  const response = await api.get<{ reviews: TriageReviewMetadata[] }>("/triage/reviews", params);
  return response.reviews;
}

export async function deleteReview(id: string) {
  return sharedDeleteReview(api, id);
}
