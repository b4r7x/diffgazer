import React from "react";
import { Box, Text } from "ink";
import { OnboardingScreen } from "./screens/onboarding-screen.js";
import { useNavigation, useAppInit, useScreenHandlers, useAppState } from "./hooks/index.js";
import {
  LoadingView,
  MainMenuView,
  GitStatusView,
  GitDiffView,
  ReviewView,
  SettingsView,
  SessionsView,
  ReviewHistoryView,
} from "./views/index.js";
import type { SessionMode } from "./types.js";

export type { SessionMode };

interface AppProps {
  address: string;
  sessionMode?: SessionMode;
  sessionId?: string;
}

export function App({ address, sessionMode = "new", sessionId }: AppProps): React.ReactElement {
  const state = useAppState();
  const { view, setView, diffState, reviewState } = useNavigation(state.navigationActions);

  useAppInit({
    config: state.initConfig,
    sessionMode,
    sessionId,
    sessionActions: state.sessionActions,
    setView,
  });

  const handlers = useScreenHandlers(state.screenHandlerConfig(setView));

  if (view === "loading") return <LoadingView />;
  if (view === "onboarding") {
    return <OnboardingScreen saveState={state.config.saveState} error={state.config.error} onSave={handlers.config.onSave} />;
  }

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold color="cyan">Stargazer</Text>
      <Text>Server: <Text color="blue">{address}</Text></Text>
      <Text color="green">Running</Text>

      {view === "main" && <MainMenuView />}
      {view === "git-status" && <GitStatusView state={state.gitStatus.state} />}
      {view === "git-diff" && <GitDiffView state={state.gitDiff.state} staged={diffState.staged} />}
      {view === "review" && <ReviewView state={state.review.state} staged={reviewState.staged} />}
      {view === "settings" && (
        <SettingsView
          provider={state.config.currentConfig?.provider ?? "Unknown"}
          model={state.config.currentConfig?.model}
          settingsState={state.config.settingsState}
          deleteState={state.config.deleteState}
          error={state.config.error}
          onDelete={handlers.config.onDelete}
          onBack={handlers.config.onBack}
        />
      )}
      {view === "sessions" && (
        <SessionsView
          sessions={state.sessionList.items}
          listState={state.sessionList.listState}
          error={state.activeSession.error || state.sessionList.error}
          onSelect={handlers.sessions.onSelect}
          onDelete={handlers.sessions.onDelete}
          onBack={handlers.sessions.onBack}
          onNewSession={handlers.sessions.onNewSession}
        />
      )}
      {view === "review-history" && (
        <ReviewHistoryView
          reviews={state.reviewHistory.items}
          currentReview={state.reviewHistory.current}
          listState={state.reviewHistory.listState}
          error={state.reviewHistory.error}
          onSelect={handlers.reviewHistory.onSelect}
          onDelete={handlers.reviewHistory.onDelete}
          onBack={handlers.reviewHistory.onBack}
          onClearCurrent={handlers.reviewHistory.onClearCurrent}
        />
      )}
    </Box>
  );
}
