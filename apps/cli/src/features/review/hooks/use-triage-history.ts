import { useEntityList } from "../../../hooks/use-entity-list.js";
import type { SavedTriageReview, TriageReviewMetadata } from "@repo/schemas/triage-storage";
import { getTriageReviews, getTriageReview, deleteTriageReview } from "../api/index.js";

export function useTriageHistory() {
  const projectPath = process.cwd();

  const [state, actions] = useEntityList<SavedTriageReview, TriageReviewMetadata>({
    fetchList: async (path) => {
      const res = await getTriageReviews({ projectPath: path });
      return {
        items: res.reviews,
        warnings: res.warnings || [],
      };
    },
    fetchOne: async (id) => {
      const res = await getTriageReview(id);
      return res.review;
    },
    deleteOne: async (id) => {
      const res = await deleteTriageReview(id);
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
