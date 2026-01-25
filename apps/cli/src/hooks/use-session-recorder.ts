import { createContext, useContext, useEffect, useRef, useCallback, useState } from "react";
import type { SessionEventType } from "@repo/schemas/session";
import {
  appendEvent,
  createEventSession,
  getLatestSession,
} from "@repo/core/storage";

export interface SessionRecorderContextValue {
  sessionId: string | null;
  recordEvent: (type: SessionEventType, payload: Record<string, unknown>) => void;
}

export const SessionRecorderContext = createContext<SessionRecorderContextValue | null>(null);

export interface UseSessionRecorderResult {
  sessionId: string | null;
  recordEvent: (type: SessionEventType, payload: Record<string, unknown>) => void;
}

export function useSessionRecorder(projectId: string): UseSessionRecorderResult {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const initializedRef = useRef(false);
  const projectIdRef = useRef(projectId);

  projectIdRef.current = projectId;

  const recordEvent = useCallback(
    (type: SessionEventType, payload: Record<string, unknown>): void => {
      const currentSessionId = sessionId;
      if (!currentSessionId) return;

      const event = {
        ts: Date.now(),
        type,
        payload,
      };

      appendEvent(currentSessionId, event, projectIdRef.current).catch((error) => {
        console.error("[SessionRecorder] Failed to record event:", error);
      });
    },
    [sessionId]
  );

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    const initSession = async () => {
      const latestResult = await getLatestSession(projectId);

      if (latestResult.ok && latestResult.value) {
        setSessionId(latestResult.value);
        const resumeEvent = {
          ts: Date.now(),
          type: "RUN_RESUMED" as const,
          payload: { resumedAt: new Date().toISOString() },
        };
        appendEvent(latestResult.value, resumeEvent, projectId).catch((error) => {
          console.error("[SessionRecorder] Failed to record RUN_RESUMED:", error);
        });
      } else {
        const createResult = await createEventSession(projectId);
        if (createResult.ok) {
          setSessionId(createResult.value);
          const createEvent = {
            ts: Date.now(),
            type: "RUN_CREATED" as const,
            payload: { createdAt: new Date().toISOString() },
          };
          appendEvent(createResult.value, createEvent, projectId).catch((error) => {
            console.error("[SessionRecorder] Failed to record RUN_CREATED:", error);
          });
        } else {
          console.error("[SessionRecorder] Failed to create session:", createResult.error);
        }
      }
    };

    initSession();
  }, [projectId]);

  return { sessionId, recordEvent };
}

export function useSessionRecorderContext(): SessionRecorderContextValue {
  const context = useContext(SessionRecorderContext);
  if (!context) {
    throw new Error("useSessionRecorderContext must be used within a SessionRecorderContext.Provider");
  }
  return context;
}
