import { useCallback, useState } from "react";
import type {
  Session,
  SessionMessage,
  MessageRole,
} from "@repo/schemas/session";
import { api } from "../../../lib/api.js";
import { getErrorMessage } from "@repo/core";
import { type ApiError } from "@repo/api";
import {
  useAsyncOperation,
  type AsyncError,
} from "../../../hooks/use-async-operation.js";

export type SessionState = "idle" | "loading" | "active" | "error";

function isNotFoundError(e: unknown): e is ApiError {
  if (!e || typeof e !== "object") return false;
  const err = e as ApiError;
  return err.code === "NOT_FOUND" || err.status === 404;
}

/**
 * Maps async operation status to session state.
 * "success" in async operation means "active" session.
 */
function mapStatusToState(
  status: "idle" | "loading" | "success" | "error"
): SessionState {
  return status === "success" ? "active" : status;
}

export function useActiveSession() {
  const projectPath = process.cwd();

  const {
    state: asyncState,
    execute,
    reset,
    setData,
  } = useAsyncOperation<Session>();

  // Separate error state for message operations that don't affect session state
  const [messageError, setMessageError] = useState<AsyncError | null>(null);

  const state = mapStatusToState(asyncState.status);
  const currentSession = asyncState.data ?? null;
  // Combine session errors with message errors, prioritizing session errors
  const error = asyncState.error ?? messageError;

  const createSession = useCallback(
    async (title?: string): Promise<Session | null> => {
      return execute(async () => {
        const result = await api().post<{ session: Session }>("/sessions", {
          projectPath,
          title,
        });
        return result.session;
      });
    },
    [execute, projectPath]
  );

  const loadSession = useCallback(
    async (sessionId: string): Promise<Session | null> => {
      return execute(async () => {
        const result = await api().get<{ session: Session }>(
          `/sessions/${sessionId}`
        );
        return result.session;
      });
    },
    [execute]
  );

  const continueLastSession = useCallback(async (): Promise<Session | null> => {
    return execute(async () => {
      try {
        const result = await api().get<{ session: Session }>(
          `/sessions/last?projectPath=${encodeURIComponent(projectPath)}`
        );
        return result.session;
      } catch (e) {
        if (isNotFoundError(e)) {
          // Create a new session if no last session exists
          const result = await api().post<{ session: Session }>("/sessions", {
            projectPath,
          });
          return result.session;
        }
        throw e;
      }
    });
  }, [execute, projectPath]);

  const addMessage = useCallback(
    async (role: MessageRole, content: string): Promise<SessionMessage | null> => {
      if (!currentSession) return null;

      // Clear any previous message error
      setMessageError(null);

      try {
        const result = await api().post<{ message: SessionMessage }>(
          `/sessions/${currentSession.metadata.id}/messages`,
          { role, content }
        );

        // Update session with new message
        setData({
          ...currentSession,
          messages: [...currentSession.messages, result.message],
          metadata: {
            ...currentSession.metadata,
            messageCount: currentSession.metadata.messageCount + 1,
            updatedAt: result.message.createdAt,
          },
        });

        return result.message;
      } catch (e) {
        // Set error without changing session state - keeps session "active"
        setMessageError({ message: `Failed to send message: ${getErrorMessage(e)}` });
        return null;
      }
    },
    [currentSession, setData]
  );

  const clearSession = useCallback(() => {
    reset();
    setMessageError(null);
  }, [reset]);

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
