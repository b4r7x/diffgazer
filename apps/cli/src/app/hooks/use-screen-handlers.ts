import type { View } from "./use-navigation.js";
import type { AIProvider } from "@repo/schemas";

interface UseScreenHandlersOptions {
  setView: (view: View) => void;
  config: {
    saveConfig: (provider: AIProvider, apiKey: string, model?: string) => Promise<unknown>;
    deleteConfig: () => Promise<unknown>;
  };
  session: {
    loadSession: (id: string) => Promise<unknown>;
    deleteSession: (id: string) => Promise<unknown>;
    createSession: (title?: string) => Promise<unknown>;
    currentSession: { metadata: { id: string } } | null;
  };
  reviewHistory: {
    loadReview: (id: string) => Promise<unknown>;
    deleteReview: (id: string) => Promise<unknown>;
    reset: () => void;
    clearCurrentReview: () => void;
  };
  chat: {
    sendMessage: (sessionId: string, message: string) => Promise<unknown>;
  };
}

export function useScreenHandlers({
  setView,
  config,
  session,
  reviewHistory,
  chat,
}: UseScreenHandlersOptions) {
  return {
    config: {
      onSave: (provider: AIProvider, apiKey: string, model?: string) =>
        void config.saveConfig(provider, apiKey, model),
      onDelete: () => void config.deleteConfig(),
      onBack: () => setView("main"),
    },
    sessions: {
      onSelect: (item: { id: string }) => {
        void session.loadSession(item.id);
        setView("main");
      },
      onDelete: (item: { id: string }) => void session.deleteSession(item.id),
      onBack: () => setView("main"),
      onNewSession: () => {
        void session.createSession();
        setView("main");
      },
    },
    reviewHistory: {
      onSelect: (review: { id: string }) => void reviewHistory.loadReview(review.id),
      onDelete: (review: { id: string }) => void reviewHistory.deleteReview(review.id),
      onBack: () => {
        reviewHistory.reset();
        setView("main");
      },
      onClearCurrent: reviewHistory.clearCurrentReview,
    },
    chat: {
      onSubmit: (message: string) => {
        if (!session.currentSession) return;
        void chat.sendMessage(session.currentSession.metadata.id, message).then(() => {
          if (session.currentSession) {
            void session.loadSession(session.currentSession.metadata.id);
          }
        });
      },
    },
  };
}
