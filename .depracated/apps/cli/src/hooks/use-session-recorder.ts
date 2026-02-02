// TODO: This hook needs API endpoints for session recording.
// Storage was moved to apps/server/src/storage/session-events.ts.
// The CLI should call server API endpoints instead of direct storage access.
// Required endpoints:
//   - GET /api/session-events/latest?projectId=xxx
//   - POST /api/session-events?projectId=xxx (create session)
//   - POST /api/session-events/:sessionId/events?projectId=xxx (append event)

import { createContext, useContext, useCallback, useState } from "react";
import type { SessionEventType } from "@repo/schemas/session";

export interface SessionRecorderContextValue {
  sessionId: string | null;
  recordEvent: (type: SessionEventType, payload: Record<string, unknown>) => void;
}

export const SessionRecorderContext = createContext<SessionRecorderContextValue | null>(null);

export interface UseSessionRecorderResult {
  sessionId: string | null;
  recordEvent: (type: SessionEventType, payload: Record<string, unknown>) => void;
}

export function useSessionRecorder(_projectId: string): UseSessionRecorderResult {
  // TODO: Initialize session via API call to GET /api/session-events/latest?projectId=xxx
  // If no session exists, call POST /api/session-events?projectId=xxx to create one
  const [sessionId] = useState<string | null>(null);

  const recordEvent = useCallback(
    (type: SessionEventType, payload: Record<string, unknown>): void => {
      // TODO: Call POST /api/session-events/:sessionId/events?projectId=xxx
      console.warn(`[SessionRecorder] recordEvent not implemented - needs API endpoint. Event: ${type}`, payload);
    },
    []
  );

  return { sessionId, recordEvent };
}

export function useSessionRecorderContext(): SessionRecorderContextValue {
  const context = useContext(SessionRecorderContext);
  if (!context) {
    throw new Error("useSessionRecorderContext must be used within a SessionRecorderContext.Provider");
  }
  return context;
}
