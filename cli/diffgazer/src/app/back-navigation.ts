import { getBackTarget as getBackPath } from "@diffgazer/core/navigation";
import type { Route, ScreenName } from "./routes.js";
import { SCREEN_MAP } from "./router.js";

function screenToPath(screen: ScreenName): string {
  return screen === "home" ? "/" : `/${screen}`;
}

function pathToRoute(path: string): Route | null {
  if (path === "/") return { screen: "home" };
  const screenName = path.slice(1);
  if (!(screenName in SCREEN_MAP)) return null;
  return { screen: screenName as ScreenName };
}

export function getBackTarget(currentScreen: ScreenName): Route | null {
  const backPath = getBackPath(screenToPath(currentScreen));
  return backPath ? pathToRoute(backPath) : null;
}
