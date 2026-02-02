import { useCallback, useState } from "react";
import type {
  Session,
  SessionMessage,
  MessageRole,
} from "@repo/schemas/session";
import { getErrorMessage } from "@repo/core";
import { type ApiError } from "@repo/api";
import {
  useAsyncOperation,
  type AsyncError,
} from "../../../hooks/use-async-operation.js";
import {
  createSession as createSessionApi,
  getSession,
  getLastSession,
  addSessionMessage,
} from "../api/sessions-api.js";

export type SessionState = "idle" | "loading" | "active" | "error";

function isNotFoundError(e: unknown): e is ApiError {
  if (!e || typeof e !== "object") return false;
  const err = e as ApiError;
  return err.code === "NOT_FOUND" || err.status === 404;
}

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
  const [messageError, setMessageError] = useState<AsyncError | null>(null);

  const state = mapStatusToState(asyncState.status);
  const currentSession = asyncState.data ?? null;
  const error = asyncState.error ?? messageError;

  const createSession = useCallback(
    async (title?: string): Promise<Session | null> => {
      return execute(async () => {
        const result = await createSessionApi({ projectPath, title });
        return result.session;
      });
    },
    [execute, projectPath]
  );

  const loadSession = useCallback(
    async (sessionId: string): Promise<Session | null> => {
      return execute(async () => {
        const result = await getSession(sessionId);
        return result.session;
      });
    },
    [execute]
  );

  const continueLastSession = useCallback(async (): Promise<Session | null> => {
    return execute(async () => {
      try {
        const result = await getLastSession(projectPath);
        return result.session;
      } catch (e) {
        if (isNotFoundError(e)) {
          const result = await createSessionApi({ projectPath });
          return result.session;
        }
        throw e;
      }
    });
  }, [execute, projectPath]);

  const addMessage = useCallback(
    async (role: MessageRole, content: string): Promise<SessionMessage | null> => {
      if (!currentSession) return null;

      setMessageError(null);

      try {
        const result = await addSessionMessage({
          sessionId: currentSession.metadata.id,
          role,
          content,
        });

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
