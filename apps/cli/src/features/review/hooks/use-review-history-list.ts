import { useEntityList } from "../../../hooks/use-entity-list.js";
import { api } from "../../../lib/api.js";
import type { SavedReview, ReviewHistoryMetadata } from "@repo/schemas/review-history";

export function useReviewHistoryList() {
  const projectPath = process.cwd();

  const [state, actions] = useEntityList<SavedReview, ReviewHistoryMetadata>({
    fetchList: async (path) => {
      const res = await api().get<{ reviews: ReviewHistoryMetadata[]; warnings?: string[] }>(
        `/reviews?projectPath=${encodeURIComponent(path)}`
      );
      return {
        items: res.reviews,
        warnings: res.warnings || [],
      };
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

  return {
    items: state.items,
    warnings: state.warnings,
    current: state.current,
    listState: state.listState,
    error: state.error,
    loadList: () => actions.loadList(projectPath),
    loadOne: actions.loadOne,
    remove: actions.remove,
    clearCurrent: actions.clearCurrent,
    reset: actions.reset,
  };
}
