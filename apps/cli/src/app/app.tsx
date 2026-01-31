import React, { useEffect, useCallback } from "react";
import { createHash } from "node:crypto";
import { OnboardingScreen, SETTINGS_FOOTER_SHORTCUTS } from "./screens/index.js";
import { TrustWizardScreen } from "./screens/trust-wizard-screen.js";
import { useNavigation, useAppInit, useScreenHandlers, useAppState, CurrentViewProvider } from "../features/app/index.js";
import {
  LoadingView,
  MainMenuView,
  GitStatusView,
  GitDiffView,
  ReviewView,
  SettingsView,
  SettingsHubView,
  SettingsTrustView,
  SettingsThemeView,
  SettingsProvidersView,
  SettingsDiagnosticsView,
  HistoryView,
  MAIN_MENU_FOOTER_SHORTCUTS,
  SETTINGS_HUB_FOOTER_SHORTCUTS,
  SETTINGS_TRUST_FOOTER_SHORTCUTS,
  SETTINGS_PROVIDERS_FOOTER_SHORTCUTS,
  GIT_STATUS_FOOTER_SHORTCUTS,
  GIT_DIFF_FOOTER_SHORTCUTS,
  SETTINGS_THEME_FOOTER_SHORTCUTS,
  SETTINGS_DIAGNOSTICS_FOOTER_SHORTCUTS,
  HISTORY_FOOTER_SHORTCUTS,
} from "./views/index.js";
import type { AppView, SettingsSection, SessionMode } from "../types/index.js";
import type { AIProvider } from "@repo/schemas/config";
import { ThemeProvider, useSettings, SessionRecorderProvider, useSessionRecorderContext, KeyModeProvider } from "../hooks/index.js";
import { GlobalLayout } from "../components/layout/global-layout.js";

export type { SessionMode };

function createProjectId(path: string): string {
  return createHash("sha256").update(path).digest("hex").slice(0, 16);
}

const VIEW_SHORTCUTS: Record<string, typeof MAIN_MENU_FOOTER_SHORTCUTS> = {
  main: MAIN_MENU_FOOTER_SHORTCUTS,
  settings: SETTINGS_FOOTER_SHORTCUTS,
  "settings-hub": SETTINGS_HUB_FOOTER_SHORTCUTS,
  "settings-trust": SETTINGS_TRUST_FOOTER_SHORTCUTS,
  "settings-providers": SETTINGS_PROVIDERS_FOOTER_SHORTCUTS,
  "settings-theme": SETTINGS_THEME_FOOTER_SHORTCUTS,
  "settings-diagnostics": SETTINGS_DIAGNOSTICS_FOOTER_SHORTCUTS,
  "git-status": GIT_STATUS_FOOTER_SHORTCUTS,
  "git-diff": GIT_DIFF_FOOTER_SHORTCUTS,
  history: HISTORY_FOOTER_SHORTCUTS,
};

interface AppProps {
  address: string;
  sessionMode?: SessionMode;
  sessionId?: string;
}

interface AppContentProps {
  address: string;
  sessionMode: SessionMode;
  sessionId?: string;
  projectId: string;
  repoRoot: string;
}

function AppContent({ address, sessionMode, sessionId, projectId, repoRoot }: AppContentProps): React.ReactElement {
  const state = useAppState();
  const { view, setView, diffState, reviewState } = useNavigation(state.navigationActions);
  const localSettings = useSettings();
  const { recordEvent } = useSessionRecorderContext();

  const theme = localSettings.settings?.theme ?? "auto";
  const goToSettingsHub = useCallback(() => setView("settings-hub"), [setView]);
  const goToMain = useCallback(() => setView("main"), [setView]);
  const handleSettingsNavigate = useCallback(
    (section: SettingsSection) => setView(`settings-${section}` as AppView),
    [setView]
  );

  // Provider configuration handlers - navigate to onboarding for now
  // A future enhancement could show inline dialogs
  const handleSelectModel = useCallback(
    (_provider: AIProvider) => setView("onboarding"),
    [setView]
  );

  const handleSetApiKey = useCallback(
    (_provider: AIProvider) => setView("onboarding"),
    [setView]
  );

  const handleExportReview = useCallback(
    (review: { id: string; title?: string }) => {
      // Export functionality - placeholder until file export is implemented
      recordEvent("SETTINGS_CHANGED", { action: "export_review_requested", reviewId: review.id });
    },
    [recordEvent]
  );

  useEffect(() => {
    localSettings.loadSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount
  }, []);

  useEffect(() => {
    if (view === "main") {
      void state.config.loadSettings();
      void state.trust.loadTrust(projectId);
      void state.reviewHistory.loadList();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- state methods are stable refs from useAppState
  }, [view, projectId]);

  useAppInit({
    config: state.initConfig,
    trust: {
      checkTrust: state.trust.checkTrust,
      loadState: state.trust.loadState,
      saveState: state.trust.saveState,
    },
    projectId,
    sessionMode,
    sessionId,
    sessionActions: state.sessionActions,
    setView,
  });

  const handlers = useScreenHandlers({
    ...state.screenHandlerConfig(setView, projectId, repoRoot, localSettings, address),
    recordEvent,
  });

  const renderContent = () => {
    if (view === "loading") {
      return (
        <ThemeProvider theme={theme}>
          <LoadingView />
        </ThemeProvider>
      );
    }

    if (view === "trust-wizard") {
      return (
        <ThemeProvider theme={theme}>
          <GlobalLayout shortcuts={[]}>
            <TrustWizardScreen
              projectId={projectId}
              repoRoot={repoRoot}
              onComplete={(trustConfig) => void state.trust.saveTrust(trustConfig)}
            />
          </GlobalLayout>
        </ThemeProvider>
      );
    }

    if (view === "onboarding") {
      return (
        <ThemeProvider theme={theme}>
          <GlobalLayout shortcuts={[]}>
            <OnboardingScreen
              saveState={state.config.saveState}
              error={state.config.error}
              onSave={handlers.config.onSave}
            />
          </GlobalLayout>
        </ThemeProvider>
      );
    }

    const shortcuts = VIEW_SHORTCUTS[view] ?? [];

    return (
      <ThemeProvider theme={theme}>
        <GlobalLayout shortcuts={shortcuts} key={view}>
          {view === "main" && (
            <MainMenuView
              provider={state.config.currentConfig?.provider ?? "Not configured"}
              model={state.config.currentConfig?.model}
              isTrusted={Boolean(state.trust.trustConfig)}
              lastReviewAt={state.reviewHistory.items[0]?.createdAt ?? null}
              hasLastReview={state.reviewHistory.items.length > 0}
              onSelect={handlers.menu.onSelect}
            />
          )}
          {view === "git-status" && <GitStatusView state={state.gitStatus.state} />}
          {view === "git-diff" && <GitDiffView state={state.gitDiff.state} staged={diffState.staged} />}
          {view === "review" && <ReviewView state={state.review.state} staged={reviewState.staged} agentEvents={state.review.agentEvents} />}
          {view === "settings" && (
            <SettingsView
              projectId={projectId}
              repoRoot={repoRoot}
              onBack={handlers.config.onBack}
            />
          )}
          {view === "settings-hub" && (
            <SettingsHubView
              projectId={projectId}
              onNavigate={handleSettingsNavigate}
              onBack={goToMain}
            />
          )}
          {view === "settings-trust" && (
            <SettingsTrustView projectId={projectId} repoRoot={repoRoot} onBack={goToSettingsHub} />
          )}
          {view === "settings-theme" && (
            <SettingsThemeView projectId={projectId} onBack={goToSettingsHub} />
          )}
          {view === "settings-providers" && (
            <SettingsProvidersView
              projectId={projectId}
              onBack={goToSettingsHub}
            />
          )}
          {view === "settings-diagnostics" && <SettingsDiagnosticsView onBack={goToSettingsHub} />}
          {view === "history" && (
            <HistoryView
              reviews={state.reviewHistory.items}
              sessions={state.sessionList.items}
              onResumeReview={handlers.reviewHistory.onSelect}
              onExportReview={handleExportReview}
              onDeleteReview={handlers.reviewHistory.onDelete}
              onViewSession={handlers.sessions.onSelect}
              onDeleteSession={handlers.sessions.onDelete}
              onBack={handlers.reviewHistory.onBack}
            />
          )}
        </GlobalLayout>
      </ThemeProvider>
    );
  };

  return (
    <CurrentViewProvider currentView={view}>
      {renderContent()}
    </CurrentViewProvider>
  );
}

export function App({ address, sessionMode = "new", sessionId }: AppProps): React.ReactElement {
  const repoRoot = process.cwd();
  const projectId = createProjectId(repoRoot);

  return (
    <SessionRecorderProvider projectId={projectId}>
      <KeyModeProvider>
        <AppContent
          address={address}
          sessionMode={sessionMode}
          sessionId={sessionId}
          projectId={projectId}
          repoRoot={repoRoot}
        />
      </KeyModeProvider>
    </SessionRecorderProvider>
  );
}
