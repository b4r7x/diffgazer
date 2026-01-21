import { useState } from "react";
import { useEntityList } from "../../../hooks/use-entity-list.js";
import { api } from "../../../lib/api.js";
import type {
  SavedReview,
  ReviewHistoryMetadata,
} from "@repo/schemas/review-history";

export function useReviewHistory() {
  const projectPath = process.cwd();
  const [currentReview, setCurrentReview] = useState<SavedReview | null>(null);

  const [state, actions] = useEntityList<SavedReview, ReviewHistoryMetadata>({
    fetchList: async (path) => {
      const res = await api().get<{
        reviews: ReviewHistoryMetadata[];
        warnings?: string[];
      }>(`/reviews?projectPath=${encodeURIComponent(path)}`);
      return { items: res.reviews, warnings: res.warnings || [] };
    },
    fetchOne: async (id) => {
      const res = await api().get<{ review: SavedReview }>(`/reviews/${id}`);
      return res.review;
    },
    deleteOne: async (id) => {
      const res = await api().delete<{ existed: boolean }>(`/reviews/${id}`);
      return { existed: res.existed };
    },
    getId: (item) => item.id,
  });

  async function listReviews() {
    return actions.loadList(projectPath);
  }

  async function loadReview(id: string) {
    const review = await actions.loadOne(id);
    setCurrentReview(review);
    return review;
  }

  function clearCurrentReview() {
    setCurrentReview(null);
  }

  function reset() {
    actions.reset();
    setCurrentReview(null);
  }

  return {
    reviews: state.items,
    warnings: state.warnings,
    currentReview,
    listState: state.listState,
    error: state.error,
    listReviews,
    loadReview,
    deleteReview: actions.remove,
    clearCurrentReview,
    reset,
  };
}
