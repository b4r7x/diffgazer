// TODO: This hook needs API endpoints for session events.
// Storage was moved to apps/server/src/storage/session-events.ts.
// The CLI should call server API endpoints instead of direct storage access.
// Required endpoints:
//   - GET /api/session-events?projectId=xxx
//   - GET /api/session-events/:sessionId?projectId=xxx
//   - POST /api/session-events?projectId=xxx (create session)
//   - POST /api/session-events/:sessionId/events?projectId=xxx (append event)

import { useState, useCallback } from "react";
import type { Result } from "@repo/core";
import type { SessionEvent } from "@repo/schemas/session";
import type { AppError } from "@repo/core";

export type SessionEventErrorCode =
  | "NOT_FOUND"
  | "PARSE_ERROR"
  | "WRITE_ERROR"
  | "PERMISSION_ERROR"
  | "NOT_IMPLEMENTED";

export type SessionEventError = AppError<SessionEventErrorCode>;

export interface SessionMetadataInfo {
  sessionId: string;
  createdAt: number;
  eventCount: number;
}

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

const notImplementedError: SessionEventError = {
  code: "NOT_IMPLEMENTED",
  message: "Session events API not yet implemented. See TODO at top of file.",
};

export function useSessionEvents(): UseSessionEventsResult {
  const [sessions, setSessions] = useState<SessionMetadataInfo[]>([]);
  const [events, setEvents] = useState<SessionEvent[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<SessionEventError | null>(null);

  const listSessions = useCallback(
    async (_projectId: string): Promise<Result<SessionMetadataInfo[], SessionEventError>> => {
      // TODO: Call GET /api/session-events?projectId=xxx
      console.warn("[useSessionEvents] listSessions not implemented - needs API endpoint");
      return { ok: false, error: notImplementedError };
    },
    []
  );

  const loadEvents = useCallback(
    async (_projectId: string, _sessionId: string): Promise<Result<SessionEvent[], SessionEventError>> => {
      // TODO: Call GET /api/session-events/:sessionId?projectId=xxx
      console.warn("[useSessionEvents] loadEvents not implemented - needs API endpoint");
      return { ok: false, error: notImplementedError };
    },
    []
  );

  const createSession = useCallback(
    async (_projectId: string): Promise<Result<string, SessionEventError>> => {
      // TODO: Call POST /api/session-events?projectId=xxx
      console.warn("[useSessionEvents] createSession not implemented - needs API endpoint");
      return { ok: false, error: notImplementedError };
    },
    []
  );

  const appendEvent = useCallback(
    async (
      _projectId: string,
      _sessionId: string,
      _event: SessionEvent
    ): Promise<Result<void, SessionEventError>> => {
      // TODO: Call POST /api/session-events/:sessionId/events?projectId=xxx
      console.warn("[useSessionEvents] appendEvent not implemented - needs API endpoint");
      return { ok: false, error: notImplementedError };
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
