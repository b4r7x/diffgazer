import { api } from "@/lib/api";
import type { ReviewMetadata } from "@stargazer/api";

export async function getReviews(projectPath?: string): Promise<ReviewMetadata[]> {
  const response = await api.getReviews(projectPath);
  return response.reviews;
}

export async function deleteReview(id: string) {
  return api.deleteReview(id);
}
