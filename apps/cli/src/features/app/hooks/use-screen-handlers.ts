import type { AppView } from "./use-navigation.js";
import type { AIProvider } from "@repo/schemas";
import type { Theme, TrustCapabilities, SettingsConfig, TrustConfig } from "@repo/schemas/settings";
import type { MenuAction } from "../../../app/views/main-menu-view.js";
import type { SessionEventType } from "@repo/schemas/session";
import { openWebUi } from "../../../lib/web-ui.js";

interface UseScreenHandlersOptions {
  setView: (view: AppView) => void;
  config: {
    saveConfig: (provider: AIProvider, apiKey: string, model?: string) => Promise<unknown>;
    deleteConfig: () => Promise<unknown>;
    deleteProviderCredentials: (provider: AIProvider) => Promise<unknown>;
    loadSettings: () => Promise<unknown>;
  };
  settings: {
    settings: SettingsConfig | null;
    saveSettings: (config: SettingsConfig) => Promise<unknown>;
  };
  trust: {
    projectId: string;
    trustConfig: TrustConfig | null;
    saveTrust: (config: TrustConfig) => Promise<unknown>;
    repoRoot: string;
  };
  session: {
    loadSession: (id: string) => Promise<unknown>;
    deleteSession: (id: string) => Promise<unknown>;
    createSession: (title?: string) => Promise<unknown>;
    currentSession: { metadata: { id: string } } | null;
  };
  review: {
    startReview: (staged?: boolean) => Promise<unknown>;
    reset: () => void;
  };
  reviewHistory: {
    loadReview: (id: string) => Promise<unknown>;
    deleteReview: (id: string) => Promise<unknown>;
    listReviews: () => Promise<unknown>;
    reset: () => void;
    clearCurrentReview: () => void;
    items: Array<{ id: string; createdAt?: string }>;
  };
  chat: {
    sendMessage: (sessionId: string, message: string) => Promise<unknown>;
  };
  web: {
    apiUrl: string;
    webPort?: number | string;
  };
  recordEvent?: (type: SessionEventType, payload: Record<string, unknown>) => void;
}

export function useScreenHandlers({
  setView,
  config,
  settings,
  trust,
  session,
  review,
  reviewHistory,
  chat,
  web,
  recordEvent,
}: UseScreenHandlersOptions) {
  const handleSaveTheme = (theme: Theme) => {
    const currentSettings = settings.settings ?? {
      theme: "auto" as const,
      defaultLenses: ["correctness"] as const,
      defaultProfile: null,
      severityThreshold: "medium" as const,
    };
    void settings.saveSettings({ ...currentSettings, theme });
    recordEvent?.("SETTINGS_CHANGED", { field: "theme", value: theme });
  };

  const handleSaveTrust = (capabilities: TrustCapabilities) => {
    void trust.saveTrust({
      projectId: trust.projectId,
      repoRoot: trust.repoRoot,
      trustedAt: new Date().toISOString(),
      capabilities,
      trustMode: "persistent",
    });
    recordEvent?.("SETTINGS_CHANGED", { field: "trust", capabilities });
  };

  const handleSelectProvider = (_provider: AIProvider) => {
    // Provider selection is handled in the credentials step
  };

  const handleSaveCredentials = (apiKey: string, provider: AIProvider, model?: string) => {
    void config.saveConfig(provider, apiKey, model);
  };

  const handleMenuSelect = (action: MenuAction) => {
    switch (action) {
      case "review-unstaged":
        setView("review");
        void review.startReview(false);
        break;
      case "review-staged":
        setView("review");
        void review.startReview(true);
        break;
      case "review-files":
        // File picker not yet implemented, fall back to unstaged review
        setView("review");
        void review.startReview(false);
        break;
      case "resume-review":
        if (reviewHistory.items.length > 0) {
          const lastReview = reviewHistory.items[0];
          if (lastReview) {
            void reviewHistory.loadReview(lastReview.id);
            setView("review-history");
          }
        }
        break;
      case "history":
        void reviewHistory.listReviews();
        setView("review-history");
        break;
      case "open-web":
        void openWebUi({ apiUrl: web.apiUrl, webPort: web.webPort });
        break;
      case "settings":
        void config.loadSettings();
        setView("settings");
        break;
      case "help":
        // Help view not yet implemented
        break;
      case "quit":
        // Quit is handled in the view directly via useApp().exit()
        break;
    }
  };

  return {
    menu: {
      onSelect: handleMenuSelect,
    },
    config: {
      onSave: (provider: AIProvider, apiKey: string, model?: string) =>
        void config.saveConfig(provider, apiKey, model),
      onDelete: () => void config.deleteConfig(),
      onDeleteProvider: (provider: AIProvider) => void config.deleteProviderCredentials(provider),
      onBack: () => setView("main"),
    },
    settings: {
      onSaveTheme: handleSaveTheme,
      onSaveTrust: handleSaveTrust,
      onSelectProvider: handleSelectProvider,
      onSaveCredentials: handleSaveCredentials,
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
