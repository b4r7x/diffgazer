import { useState } from "react";
import type {
  Session,
  SessionMessage,
  MessageRole,
} from "@repo/schemas/session";
import { api } from "../../../lib/api.js";
import { getErrorMessage } from "@repo/core";

export type SessionState = "idle" | "loading" | "active" | "error";

interface ApiError {
  code?: string;
  status?: number;
}

function isNotFoundError(e: unknown): e is ApiError {
  if (!e || typeof e !== "object") return false;
  const err = e as ApiError;
  return err.code === "NOT_FOUND" || err.status === 404;
}

export function useActiveSession() {
  const projectPath = process.cwd();

  const [state, setState] = useState<SessionState>("idle");
  const [currentSession, setCurrentSession] = useState<Session | null>(null);
  const [error, setError] = useState<{ message: string } | null>(null);

  async function createSession(title?: string): Promise<Session | null> {
    setState("loading");
    setError(null);
    try {
      const result = await api().post<{ session: Session }>("/sessions", {
        projectPath,
        title,
      });
      setCurrentSession(result.session);
      setState("active");
      return result.session;
    } catch (e) {
      setState("error");
      setError({ message: getErrorMessage(e) });
      return null;
    }
  }

  async function loadSession(sessionId: string): Promise<Session | null> {
    setState("loading");
    setError(null);
    try {
      const result = await api().get<{ session: Session }>(
        `/sessions/${sessionId}`
      );
      setCurrentSession(result.session);
      setState("active");
      return result.session;
    } catch (e) {
      setState("error");
      setError({ message: getErrorMessage(e) });
      return null;
    }
  }

  async function continueLastSession(): Promise<Session | null> {
    setState("loading");
    setError(null);
    try {
      const result = await api().get<{ session: Session }>(
        `/sessions/last?projectPath=${encodeURIComponent(projectPath)}`
      );
      setCurrentSession(result.session);
      setState("active");
      return result.session;
    } catch (e) {
      if (isNotFoundError(e)) {
        return createSession();
      }
      setState("error");
      setError({ message: getErrorMessage(e) });
      return null;
    }
  }

  async function addMessage(
    role: MessageRole,
    content: string
  ): Promise<SessionMessage | null> {
    if (!currentSession) return null;

    try {
      const result = await api().post<{ message: SessionMessage }>(
        `/sessions/${currentSession.metadata.id}/messages`,
        { role, content }
      );

      setCurrentSession((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          messages: [...prev.messages, result.message],
          metadata: {
            ...prev.metadata,
            messageCount: prev.metadata.messageCount + 1,
            updatedAt: result.message.createdAt,
          },
        };
      });

      return result.message;
    } catch (e) {
      setError({ message: `Failed to send message: ${getErrorMessage(e)}` });
      return null;
    }
  }

  function clearSession() {
    setCurrentSession(null);
    setState("idle");
    setError(null);
  }

  return {
    state,
    currentSession,
    error,
    createSession,
    loadSession,
    continueLastSession,
    addMessage,
    clearSession,
  };
}
