import { useEntityList } from "../../../hooks/use-entity-list.js";
import type { SavedReview, ReviewHistoryMetadata } from "@repo/schemas/review-history";
import { getReviewHistory, getReview, deleteReview } from "../api/index.js";

export function useReviewHistoryList() {
  const projectPath = process.cwd();

  const [state, actions] = useEntityList<SavedReview, ReviewHistoryMetadata>({
    fetchList: async (path) => {
      const res = await getReviewHistory({ projectPath: path });
      return {
        items: res.reviews,
        warnings: res.warnings || [],
      };
    },
    fetchOne: async (id) => {
      const res = await getReview(id);
      return res.review;
    },
    deleteOne: async (id) => {
      const res = await deleteReview(id);
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
