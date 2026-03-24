import type { Route, ScreenName } from "../app/routes.js";

export function getBackTarget(currentScreen: ScreenName): Route | null {
  if (currentScreen === "onboarding") return null;
  if (currentScreen === "settings") return { screen: "home" };
  if (currentScreen.startsWith("settings/")) return { screen: "settings" };
  return null;
}
