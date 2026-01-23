import { useEntityList } from "../../../hooks/use-entity-list.js";
import { api } from "../../../lib/api.js";
import type { Session, SessionMetadata } from "@repo/schemas/session";

/**
 * Hook for managing session list operations (list, load, delete).
 * Uses useEntityList with session-specific API configuration.
 */
export function useSessionList() {
  const projectPath = process.cwd();

  const [state, actions] = useEntityList<Session, SessionMetadata>({
    fetchList: async (path) => {
      const res = await api().get<{ sessions: SessionMetadata[]; warnings?: string[] }>(
        `/sessions?projectPath=${encodeURIComponent(path)}`
      );
      return {
        items: res.sessions,
        warnings: res.warnings || [],
      };
    },
    fetchOne: async (id) => {
      const res = await api().get<{ session: Session }>(`/sessions/${id}`);
      return res.session;
    },
    deleteOne: async (id) => {
      const res = await api().delete<{ existed: boolean }>(`/sessions/${id}`);
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
