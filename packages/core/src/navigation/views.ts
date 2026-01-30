export type AppView =
  | "loading"
  | "trust-wizard"
  | "onboarding"
  | "main"
  | "git-status"
  | "git-diff"
  | "review"
  | "chat"
  | "settings"
  | "settings-hub"
  | "settings-trust"
  | "settings-theme"
  | "settings-providers"
  | "settings-diagnostics"
  | "history"
  | "sessions"
  | "review-history";

export type SettingsSection = "trust" | "theme" | "providers" | "diagnostics";
