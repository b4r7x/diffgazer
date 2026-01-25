import { useState, useCallback } from "react";
import type { Result } from "@repo/core";
import type { SessionEvent } from "@repo/schemas/session";
import {
  listEventSessions,
  loadEvents as loadEventsFromStorage,
  createEventSession,
  appendEvent as appendEventToStorage,
  type SessionMetadataInfo,
  type SessionEventError,
} from "@repo/core/storage";

export interface UseSessionEventsState {
  sessions: SessionMetadataInfo[];
  events: SessionEvent[];
  currentSessionId: string | null;
  isLoading: boolean;
  error: SessionEventError | null;
}

export interface UseSessionEventsActions {
  listSessions: (projectId: string) => Promise<Result<SessionMetadataInfo[], SessionEventError>>;
  loadEvents: (projectId: string, sessionId: string) => Promise<Result<SessionEvent[], SessionEventError>>;
  createSession: (projectId: string) => Promise<Result<string, SessionEventError>>;
  appendEvent: (projectId: string, sessionId: string, event: SessionEvent) => Promise<Result<void, SessionEventError>>;
  clearError: () => void;
  reset: () => void;
}

export type UseSessionEventsResult = [UseSessionEventsState, UseSessionEventsActions];

export function useSessionEvents(): UseSessionEventsResult {
  const [sessions, setSessions] = useState<SessionMetadataInfo[]>([]);
  const [events, setEvents] = useState<SessionEvent[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<SessionEventError | null>(null);

  const listSessions = useCallback(
    async (projectId: string): Promise<Result<SessionMetadataInfo[], SessionEventError>> => {
      setIsLoading(true);
      setError(null);

      const result = await listEventSessions(projectId);

      if (result.ok) {
        setSessions(result.value);
      } else {
        setError(result.error);
      }

      setIsLoading(false);
      return result;
    },
    []
  );

  const loadEvents = useCallback(
    async (projectId: string, sessionId: string): Promise<Result<SessionEvent[], SessionEventError>> => {
      setIsLoading(true);
      setError(null);

      const result = await loadEventsFromStorage(sessionId, projectId);

      if (result.ok) {
        setEvents(result.value);
        setCurrentSessionId(sessionId);
      } else {
        setError(result.error);
      }

      setIsLoading(false);
      return result;
    },
    []
  );

  const createSession = useCallback(
    async (projectId: string): Promise<Result<string, SessionEventError>> => {
      setIsLoading(true);
      setError(null);

      const result = await createEventSession(projectId);

      if (result.ok) {
        setCurrentSessionId(result.value);
        setEvents([]);
      } else {
        setError(result.error);
      }

      setIsLoading(false);
      return result;
    },
    []
  );

  const appendEvent = useCallback(
    async (
      projectId: string,
      sessionId: string,
      event: SessionEvent
    ): Promise<Result<void, SessionEventError>> => {
      const result = await appendEventToStorage(sessionId, event, projectId);

      if (result.ok) {
        setEvents((prev) => [...prev, event]);
      } else {
        setError(result.error);
      }

      return result;
    },
    []
  );

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const reset = useCallback(() => {
    setSessions([]);
    setEvents([]);
    setCurrentSessionId(null);
    setIsLoading(false);
    setError(null);
  }, []);

  return [
    { sessions, events, currentSessionId, isLoading, error },
    { listSessions, loadEvents, createSession, appendEvent, clearError, reset },
  ];
}
