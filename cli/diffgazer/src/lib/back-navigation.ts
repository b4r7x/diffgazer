import { getBackTarget as getBackPath } from "@diffgazer/core/navigation";
import { isScreenName, type Route, type ScreenName } from "../app/routes";

function screenToPath(screen: ScreenName): string {
  return screen === "home" ? "/" : `/${screen}`;
}

function pathToRoute(path: string): Route | null {
  if (path === "/") return { screen: "home" };
  const screenName = path.slice(1);
  if (!isScreenName(screenName)) return null;
  return { screen: screenName };
}

export function getBackTarget(currentScreen: ScreenName): Route | null {
  const backPath = getBackPath(screenToPath(currentScreen));
  return backPath ? pathToRoute(backPath) : null;
}
