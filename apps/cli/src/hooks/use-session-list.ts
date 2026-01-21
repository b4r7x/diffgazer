import { useEntityList } from "./use-entity-list.js";
import { api } from "../lib/api.js";
import type { Session, SessionMetadata } from "@repo/schemas/session";

export function useSessionList() {
  const projectPath = process.cwd();

  const [state, actions] = useEntityList<Session, SessionMetadata>({
    fetchList: async (path) => {
      const res = await api().get<{
        sessions: SessionMetadata[];
        warnings?: string[];
      }>(`/sessions?projectPath=${encodeURIComponent(path)}`);
      return { items: res.sessions, warnings: res.warnings || [] };
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

  async function listSessions() {
    return actions.loadList(projectPath);
  }

  return {
    sessions: state.items,
    warnings: state.warnings,
    listState: state.listState,
    error: state.error,
    listSessions,
    loadSession: actions.loadOne,
    deleteSession: actions.remove,
    reset: actions.reset,
  };
}
