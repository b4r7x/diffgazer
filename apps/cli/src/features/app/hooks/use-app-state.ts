import { useCallback } from "react";
import { useGitStatus } from "../../../hooks/use-git-status.js";
import { useGitDiff } from "../../../hooks/use-git-diff.js";
import { useConfig } from "../../../hooks/use-config.js";
import { useTrust, type UseSettingsResult } from "../../../hooks/index.js";
import { useActiveSession, useSessionList } from "../../sessions/index.js";
import { useTriage, useReviewHistoryList } from "../../review/index.js";
import type { View } from "./use-navigation.js";

export function useAppState() {
  const gitStatus = useGitStatus();
  const gitDiff = useGitDiff();
  const triage = useTriage();
  const config = useConfig();
  const trust = useTrust();
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
    review: {
      state: triage.state,
      agentEvents: triage.agentEvents,
      startReview: triage.startTriage,
      reset: triage.reset,
    },
    config,
    trust,
    activeSession,
    sessionList,
    reviewHistory,
    navigationActions: {
      gitStatus: { fetch: gitStatus.fetch, reset: gitStatus.reset },
      gitDiff: { fetch: gitDiff.fetch, reset: gitDiff.reset },
      review: { startReview: triage.startTriage, reset: triage.reset },
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
    screenHandlerConfig: (setView: (view: View) => void, projectId: string, repoRoot: string, localSettings: Pick<UseSettingsResult, "settings" | "saveSettings">, address: string) => ({
      setView,
      config: { saveConfig: config.saveConfig, deleteConfig: config.deleteConfig, deleteProviderCredentials: config.deleteProviderCredentials, loadSettings: config.loadSettings },
      settings: { settings: localSettings.settings, saveSettings: localSettings.saveSettings },
      trust: { projectId, repoRoot, trustConfig: trust.trustConfig, saveTrust: trust.saveTrust },
      session: { loadSession: activeSession.loadSession, deleteSession, createSession: activeSession.createSession, currentSession: activeSession.currentSession },
      review: { startReview: triage.startTriage, reset: triage.reset },
      reviewHistory: {
        loadReview: reviewHistory.loadOne,
        deleteReview: reviewHistory.remove,
        listReviews: reviewHistory.loadList,
        reset: reviewHistory.reset,
        clearCurrentReview: reviewHistory.clearCurrent,
        items: reviewHistory.items,
      },
      chat: { sendMessage: async () => {} },
      web: { apiUrl: address },
    }),
  };
}
