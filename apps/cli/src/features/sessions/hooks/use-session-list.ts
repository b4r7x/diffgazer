import { useEntityApi } from "../../../hooks/use-entity-api.js";
import type { Session, SessionMetadata } from "@repo/schemas/session";

export function useSessionList() {
  const entity = useEntityApi<Session, SessionMetadata>({
    endpoint: "/sessions",
    listKey: "sessions",
    singleKey: "session",
  });

  return {
    sessions: entity.items,
    warnings: entity.warnings,
    listState: entity.listState,
    error: entity.error,
    listSessions: entity.loadList,
    loadSession: entity.loadOne,
    deleteSession: entity.remove,
    reset: entity.reset,
  };
}
