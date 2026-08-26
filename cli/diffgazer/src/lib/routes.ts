export type Route =
  | { screen: "home" }
  | { screen: "onboarding" }
  | {
      screen: "review";
      reviewId?: string;
      issueId?: string;
      mode?: "unstaged" | "staged";
      live?: boolean;
      /** Opens the file picker first, for a review scoped before it starts. */
      pickFiles?: boolean;
    }
  | { screen: "history" }
  | { screen: "help" }
  | { screen: "settings" }
  | { screen: "settings/theme" }
  | {
      screen: "settings/providers";
      /** "Change model" on the review error screen opens the model dialog on arrival. */
      intent?: "select-model";
    }
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

export function isScreenName(value: string): value is ScreenName {
  return Object.hasOwn(SCREEN_NAME_MAP, value);
}
