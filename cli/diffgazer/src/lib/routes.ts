export type Route =
  | { screen: "home" }
  | { screen: "onboarding" }
  | {
      screen: "review";
      reviewId?: string;
      issueId?: string;
      mode?: "unstaged" | "staged";
      live?: boolean;
    }
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

export const SCREEN_NAMES: readonly ScreenName[] = [
  "home",
  "onboarding",
  "review",
  "history",
  "help",
  "settings",
  "settings/theme",
  "settings/providers",
  "settings/storage",
  "settings/analysis",
  "settings/agent-execution",
  "settings/diagnostics",
  "settings/trust-permissions",
];

export function isScreenName(value: string): value is ScreenName {
  return (SCREEN_NAMES as readonly string[]).includes(value);
}
