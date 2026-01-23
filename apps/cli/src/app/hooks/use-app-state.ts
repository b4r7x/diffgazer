import { useMemo, useCallback } from "react";
import { useGitStatus } from "../../hooks/use-git-status.js";
import { useGitDiff } from "../../hooks/use-git-diff.js";
import { useConfig } from "../../hooks/use-config.js";
import { useActiveSession, useSessionList } from "../../features/sessions/index.js";
import { useReview, useReviewHistoryList } from "../../features/review/index.js";
import type { View } from "./use-navigation.js";

/**
 * Hook that combines all app-level state into a single unified interface.
 * This simplifies the App component by centralizing state management.
 */
export function useAppState() {
  const gitStatus = useGitStatus();
  const gitDiff = useGitDiff();
  const review = useReview();
  const config = useConfig();
  const activeSession = useActiveSession();
  const sessionList = useSessionList();
  const reviewHistory = useReviewHistoryList();

  const deleteSession = useCallback(async (id: string) => {
    const result = await sessionList.remove(id);
    if (result && activeSession.currentSession?.metadata.id === id) {
      activeSession.clearSession();
    }
    return result;
  }, [sessionList, activeSession]);

  const navigationActions = useMemo(() => ({
    gitStatus: { fetch: gitStatus.fetch, reset: gitStatus.reset },
    gitDiff: { fetch: gitDiff.fetch, reset: gitDiff.reset },
    review: { startReview: review.startReview, reset: review.reset },
    config: { loadSettings: config.loadSettings, checkState: config.checkState },
    reviewHistory: {
      listReviews: reviewHistory.loadList,
      reset: reviewHistory.reset,
      currentReview: reviewHistory.current,
    },
    session: { listSessions: sessionList.loadList, currentSession: activeSession.currentSession },
    chat: { reset: () => {} },
    onDiscussReview: async () => {},
  }), [
    gitStatus.fetch, gitStatus.reset,
    gitDiff.fetch, gitDiff.reset,
    review.startReview, review.reset,
    config.loadSettings, config.checkState,
    reviewHistory.loadList, reviewHistory.reset, reviewHistory.current,
    sessionList.loadList, activeSession.currentSession,
  ]);

  const initConfig = useMemo(() => ({
    checkConfig: config.checkConfig,
    checkState: config.checkState,
    saveState: config.saveState,
  }), [config.checkConfig, config.checkState, config.saveState]);

  const sessionActions = useMemo(() => ({
    continueLastSession: activeSession.continueLastSession,
    loadSession: activeSession.loadSession,
    listSessions: sessionList.loadList,
    createSession: activeSession.createSession,
  }), [
    activeSession.continueLastSession,
    activeSession.loadSession,
    sessionList.loadList,
    activeSession.createSession,
  ]);

  const screenHandlerConfig = useMemo(
    () => (setView: (view: View) => void) => ({
      setView,
      config: {
        saveConfig: config.saveConfig,
        deleteConfig: config.deleteConfig,
        updateConfig: async () => {},
      },
      session: {
        loadSession: activeSession.loadSession,
        deleteSession,
        createSession: activeSession.createSession,
        currentSession: activeSession.currentSession,
      },
      reviewHistory: {
        loadReview: reviewHistory.loadOne,
        deleteReview: reviewHistory.remove,
        reset: reviewHistory.reset,
        clearCurrentReview: reviewHistory.clearCurrent,
      },
      chat: { sendMessage: async () => {} },
    }),
    [
      config.saveConfig, config.deleteConfig,
      activeSession.loadSession, deleteSession, activeSession.createSession, activeSession.currentSession,
      reviewHistory.loadOne, reviewHistory.remove, reviewHistory.reset, reviewHistory.clearCurrent,
    ]
  );

  return {
    gitStatus,
    gitDiff,
    review,
    config,
    activeSession,
    sessionList,
    reviewHistory,
    navigationActions,
    initConfig,
    sessionActions,
    screenHandlerConfig,
  };
}
