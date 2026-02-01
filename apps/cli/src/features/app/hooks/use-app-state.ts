import { useCallback } from "react";
import { useGitStatus } from "../../../hooks/use-git-status.js";
import { useGitDiff } from "../../../hooks/use-git-diff.js";
import { useConfig } from "../../../hooks/use-config.js";
import { useTrust, type UseSettingsResult } from "../../../hooks/index.js";
import { useActiveSession, useSessionList } from "../../sessions/index.js";
import { useTriage, useTriageHistory } from "../../review/index.js";
import type { AppView } from "./use-navigation.js";

export function useAppState() {
  const gitStatus = useGitStatus();
  const gitDiff = useGitDiff();
  const triage = useTriage();
  const config = useConfig();
  const trust = useTrust();
  const activeSession = useActiveSession();
  const sessionList = useSessionList();
  const reviewHistory = useTriageHistory();

  const deleteSession = useCallback(async (id: string) => {
    const result = await sessionList.remove(id);
    if (result && activeSession.currentSession?.metadata.id === id) {
      activeSession.clearSession();
    }
    return result;
  }, [sessionList, activeSession]);

  const reviewActions = {
    startReview: triage.startTriage,
    reset: triage.reset,
  };

  return {
    gitStatus,
    gitDiff,
    review: {
      state: triage.state,
      agentEvents: triage.agentEvents,
      ...reviewActions,
    },
    config,
    trust,
    activeSession,
    sessionList,
    reviewHistory,
    navigationActions: {
      gitStatus: { fetch: gitStatus.fetch, reset: gitStatus.reset },
      gitDiff: { fetch: gitDiff.fetch, reset: gitDiff.reset },
      review: reviewActions,
      config: { loadSettings: config.loadSettings, checkState: config.checkState },
      reviewHistory: {
        listReviews: reviewHistory.loadList,
        reset: reviewHistory.reset,
        currentReview: reviewHistory.current,
      },
      session: {
        listSessions: sessionList.loadList,
        currentSession: activeSession.currentSession,
      },
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
    screenHandlerConfig: buildScreenHandlerConfig({
      config,
      trust,
      activeSession,
      sessionList,
      reviewActions,
      reviewHistory,
      deleteSession,
    }),
  };
}

interface ScreenHandlerDeps {
  config: ReturnType<typeof useConfig>;
  trust: ReturnType<typeof useTrust>;
  activeSession: ReturnType<typeof useActiveSession>;
  sessionList: ReturnType<typeof useSessionList>;
  reviewActions: { startReview: ReturnType<typeof useTriage>["startTriage"]; reset: ReturnType<typeof useTriage>["reset"] };
  reviewHistory: ReturnType<typeof useTriageHistory>;
  deleteSession: (id: string) => Promise<boolean | null>;
}

function buildScreenHandlerConfig(deps: ScreenHandlerDeps) {
  const { config, trust, activeSession, reviewActions, reviewHistory, deleteSession } = deps;

  return function screenHandlerConfig(
    setView: (view: AppView) => void,
    projectId: string,
    repoRoot: string,
    localSettings: Pick<UseSettingsResult, "settings" | "saveSettings">,
    address: string,
  ) {
    return {
      setView,
      config: {
        saveConfig: config.saveConfig,
        deleteConfig: config.deleteConfig,
        deleteProviderCredentials: config.deleteProviderCredentials,
        loadSettings: config.loadSettings,
      },
      settings: localSettings,
      trust: {
        projectId,
        repoRoot,
        trustConfig: trust.trustConfig,
        saveTrust: trust.saveTrust,
      },
      session: {
        loadSession: activeSession.loadSession,
        deleteSession,
        createSession: activeSession.createSession,
        currentSession: activeSession.currentSession,
      },
      review: reviewActions,
      reviewHistory: {
        loadReview: reviewHistory.loadOne,
        deleteReview: reviewHistory.remove,
        listReviews: reviewHistory.loadList,
        reset: reviewHistory.reset,
        clearCurrentReview: reviewHistory.clearCurrent,
        items: reviewHistory.items,
        current: reviewHistory.current,
      },
      chat: { sendMessage: async () => {} },
      web: { apiUrl: address },
    };
  };
}
