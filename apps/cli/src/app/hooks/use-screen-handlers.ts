import { useCallback } from "react";
import type { View } from "./use-navigation.js";
import type { AIProvider } from "@repo/schemas";

interface ConfigActions {
  saveConfig: (provider: AIProvider, apiKey: string, model?: string) => Promise<unknown>;
  deleteConfig: () => Promise<unknown>;
  updateConfig: (updates: { model?: string; maxTokens?: number | null }) => Promise<unknown>;
}

interface SessionActions {
  loadSession: (id: string) => Promise<unknown>;
  deleteSession: (id: string) => Promise<unknown>;
  createSession: (title?: string) => Promise<unknown>;
}

interface ReviewHistoryActions {
  loadReview: (id: string) => Promise<unknown>;
  deleteReview: (id: string) => Promise<unknown>;
  reset: () => void;
  clearCurrentReview: () => void;
}

interface ChatActions {
  sendMessage: (sessionId: string, message: string) => Promise<unknown>;
}

interface UseScreenHandlersOptions {
  setView: (view: View) => void;
  config: ConfigActions;
  session: SessionActions & { currentSession: { metadata: { id: string } } | null };
  reviewHistory: ReviewHistoryActions;
  chat: ChatActions;
}

/**
 * Hook that provides all screen-specific callback handlers.
 * Centralizes handler creation to reduce boilerplate in App component.
 */
export function useScreenHandlers({
  setView,
  config,
  session,
  reviewHistory,
  chat,
}: UseScreenHandlersOptions) {
  const handleSaveConfig = useCallback(
    (provider: AIProvider, apiKey: string, model?: string) => {
      void config.saveConfig(provider, apiKey, model);
    },
    [config]
  );

  const handleDeleteConfig = useCallback(
    () => void config.deleteConfig(),
    [config]
  );

  const handleUpdateConfig = useCallback(
    (updates: { model?: string; maxTokens?: number | null }) => void config.updateConfig(updates),
    [config]
  );

  const handleSettingsBack = useCallback(() => setView("main"), [setView]);

  const handleSelectSession = useCallback(
    (sessionItem: { id: string }) => {
      void session.loadSession(sessionItem.id);
      setView("main");
    },
    [session, setView]
  );

  const handleDeleteSession = useCallback(
    (sessionItem: { id: string }) => void session.deleteSession(sessionItem.id),
    [session]
  );

  const handleSessionsBack = useCallback(() => setView("main"), [setView]);

  const handleNewSession = useCallback(() => {
    void session.createSession();
    setView("main");
  }, [session, setView]);

  const handleSelectReview = useCallback(
    (review: { id: string }) => void reviewHistory.loadReview(review.id),
    [reviewHistory]
  );

  const handleDeleteReview = useCallback(
    (review: { id: string }) => void reviewHistory.deleteReview(review.id),
    [reviewHistory]
  );

  const handleReviewHistoryBack = useCallback(() => {
    reviewHistory.reset();
    setView("main");
  }, [reviewHistory, setView]);

  const handleClearCurrentReview = useCallback(
    () => reviewHistory.clearCurrentReview(),
    [reviewHistory]
  );

  const handleChatSubmit = useCallback(
    (message: string) => {
      if (!session.currentSession) return;
      void chat.sendMessage(session.currentSession.metadata.id, message).then(() => {
        if (session.currentSession) {
          void session.loadSession(session.currentSession.metadata.id);
        }
      });
    },
    [session, chat]
  );

  return {
    config: {
      onSave: handleSaveConfig,
      onDelete: handleDeleteConfig,
      onUpdate: handleUpdateConfig,
      onBack: handleSettingsBack,
    },
    sessions: {
      onSelect: handleSelectSession,
      onDelete: handleDeleteSession,
      onBack: handleSessionsBack,
      onNewSession: handleNewSession,
    },
    reviewHistory: {
      onSelect: handleSelectReview,
      onDelete: handleDeleteReview,
      onBack: handleReviewHistoryBack,
      onClearCurrent: handleClearCurrentReview,
    },
    chat: {
      onSubmit: handleChatSubmit,
    },
  };
}
