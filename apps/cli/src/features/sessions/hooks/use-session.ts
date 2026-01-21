import { useSessionList } from "./use-session-list.js";
import { useActiveSession, type SessionState } from "./use-active-session.js";
import type { ListState } from "../../../hooks/use-entity-list.js";

export type { SessionState };
export type SessionListState = ListState;

export function useSession() {
  const list = useSessionList();
  const active = useActiveSession();

  async function deleteSession(sessionId: string): Promise<boolean> {
    const result = await list.deleteSession(sessionId);
    if (result && active.currentSession?.metadata.id === sessionId) {
      active.clearSession();
    }
    return result;
  }

  return {
    state: active.state,
    currentSession: active.currentSession,
    error: active.error || list.error,
    listState: list.listState,
    sessions: list.sessions,
    createSession: active.createSession,
    loadSession: active.loadSession,
    continueLastSession: active.continueLastSession,
    addMessage: active.addMessage,
    listSessions: list.listSessions,
    deleteSession,
  };
}
