import { useEntityList } from "../../../hooks/use-entity-list.js";
import type { Session, SessionMetadata } from "@repo/schemas/session";
import { getSessionList, getSession, deleteSession } from "../api/index.js";

export function useSessionList() {
  const projectPath = process.cwd();

  const [state, actions] = useEntityList<Session, SessionMetadata>({
    fetchList: async (path) => {
      const res = await getSessionList({ projectPath: path });
      return {
        items: res.sessions,
        warnings: res.warnings || [],
      };
    },
    fetchOne: async (id) => {
      const res = await getSession(id);
      return res.session;
    },
    deleteOne: async (id) => {
      const res = await deleteSession(id);
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
