export type Route =
  | { screen: "home" }
  | { screen: "onboarding" }
  | { screen: "review"; reviewId?: string; mode?: "unstaged" | "staged" }
  | { screen: "history" }
  | { screen: "help" }
  | { screen: "settings" }
  | { screen: "settings/theme" }
  | { screen: "settings/providers" }
  | { screen: "settings/storage" }
  | { screen: "settings/analysis" }
  | { screen: "settings/agent-execution" }
  | { screen: "settings/diagnostics" }
  | { screen: "settings/trust-permissions" };

export type ScreenName = Route["screen"];
