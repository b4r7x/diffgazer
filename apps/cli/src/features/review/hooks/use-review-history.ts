import { useEntityApi } from "../../../hooks/use-entity-api.js";
import type {
  SavedReview,
  ReviewHistoryMetadata,
} from "@repo/schemas/review-history";

export function useReviewHistory() {
  const entity = useEntityApi<SavedReview, ReviewHistoryMetadata>({
    endpoint: "/reviews",
    listKey: "reviews",
    singleKey: "review",
  });

  return {
    reviews: entity.items,
    warnings: entity.warnings,
    currentReview: entity.current,
    listState: entity.listState,
    error: entity.error,
    listReviews: entity.loadList,
    loadReview: entity.loadOne,
    deleteReview: entity.remove,
    clearCurrentReview: entity.clearCurrent,
    reset: entity.reset,
  };
}
