import { useSessionList } from "./use-session-list.js";
import { useActiveSession, type SessionState } from "./use-active-session.js";
import type { ListState } from "../../../hooks/use-entity-list.js";

export type { SessionState };
export type SessionListState = ListState;

/**
 * Combined hook for session management.
 */
export function useSession() {
  const list = useSessionList();
  const active = useActiveSession();

  // Sync deletion with active session
  async function deleteSession(sessionId: string): Promise<boolean> {
    const result = await list.deleteSession(sessionId);
    if (result && active.currentSession?.metadata.id === sessionId) {
      active.clearSession();
    }
    return result;
  }

  return {
    // Active session state
    state: active.state,
    currentSession: active.currentSession,
    error: active.error || list.error,

    // List state
    listState: list.listState,
    sessions: list.sessions,

    // Active session operations
    createSession: active.createSession,
    loadSession: active.loadSession,
    continueLastSession: active.continueLastSession,
    addMessage: active.addMessage,

    // List operations
    listSessions: list.listSessions,
    deleteSession,
  };
}
