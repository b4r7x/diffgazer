import { useCallback } from "react";
import { useGitStatus } from "../../../hooks/use-git-status.js";
import { useGitDiff } from "../../../hooks/use-git-diff.js";
import { useConfig } from "../../../hooks/use-config.js";
import { useActiveSession, useSessionList } from "../../sessions/index.js";
import { useReview, useReviewHistoryList } from "../../review/index.js";
import type { View } from "./use-navigation.js";

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

  return {
    gitStatus,
    gitDiff,
    review,
    config,
    activeSession,
    sessionList,
    reviewHistory,
    navigationActions: {
      gitStatus: { fetch: gitStatus.fetch, reset: gitStatus.reset },
      gitDiff: { fetch: gitDiff.fetch, reset: gitDiff.reset },
      review: { startReview: review.startReview, reset: review.reset },
      config: { loadSettings: config.loadSettings, checkState: config.checkState },
      reviewHistory: { listReviews: reviewHistory.loadList, reset: reviewHistory.reset, currentReview: reviewHistory.current },
      session: { listSessions: sessionList.loadList, currentSession: activeSession.currentSession },
      chat: { reset: () => {} },
      onDiscussReview: async () => {},
    },
    initConfig: {
      checkConfig: config.checkConfig,
      checkState: config.checkState,
      saveState: config.saveState,
    },
    sessionActions: {
      continueLastSession: activeSession.continueLastSession,
      loadSession: activeSession.loadSession,
      listSessions: sessionList.loadList,
      createSession: activeSession.createSession,
    },
    screenHandlerConfig: (setView: (view: View) => void) => ({
      setView,
      config: { saveConfig: config.saveConfig, deleteConfig: config.deleteConfig },
      session: { loadSession: activeSession.loadSession, deleteSession, createSession: activeSession.createSession, currentSession: activeSession.currentSession },
      reviewHistory: { loadReview: reviewHistory.loadOne, deleteReview: reviewHistory.remove, reset: reviewHistory.reset, clearCurrentReview: reviewHistory.clearCurrent },
      chat: { sendMessage: async () => {} },
    }),
  };
}
