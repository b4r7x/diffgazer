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

const SCREEN_NAME_MAP = {
  home: true,
  onboarding: true,
  review: true,
  history: true,
  help: true,
  settings: true,
  "settings/theme": true,
  "settings/providers": true,
  "settings/storage": true,
  "settings/analysis": true,
  "settings/agent-execution": true,
  "settings/diagnostics": true,
  "settings/trust-permissions": true,
} satisfies Record<ScreenName, true>;

const SCREEN_NAMES: readonly ScreenName[] = Object.keys(SCREEN_NAME_MAP) as ScreenName[];

export function isScreenName(value: string): value is ScreenName {
  return (SCREEN_NAMES as readonly string[]).includes(value);
}
