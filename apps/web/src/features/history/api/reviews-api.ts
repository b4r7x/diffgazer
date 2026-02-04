import { api } from "@/lib/api";
import type { TriageReviewMetadata } from "@stargazer/api";

export async function getReviews(projectPath?: string): Promise<TriageReviewMetadata[]> {
  const response = await api.getTriageReviews(projectPath);
  return response.reviews;
}

export async function deleteReview(id: string) {
  return api.deleteTriageReview(id);
}
