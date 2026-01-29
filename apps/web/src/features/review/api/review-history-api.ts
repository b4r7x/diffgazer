import { api } from "@/lib/api";
import type { ReviewHistoryMetadata } from "@repo/schemas";
import {
  getReview as sharedGetReview,
  deleteReview as sharedDeleteReview,
} from "@repo/api";

export async function getReviewHistory(): Promise<ReviewHistoryMetadata[]> {
  return api.get<ReviewHistoryMetadata[]>("/reviews");
}

export async function getReview(id: string) {
  return sharedGetReview(api, id);
}

export async function deleteReview(id: string) {
  return sharedDeleteReview(api, id);
}
