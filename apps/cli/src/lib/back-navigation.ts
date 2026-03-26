import { getBackTarget as getBackPath } from "@diffgazer/core/navigation";
import type { Route, ScreenName } from "../app/routes.js";

function screenToPath(screen: ScreenName): string {
  return screen === "home" ? "/" : `/${screen}`;
}

function pathToRoute(path: string): Route {
  return path === "/" ? { screen: "home" } : { screen: path.slice(1) as ScreenName };
}

export function getBackTarget(currentScreen: ScreenName): Route | null {
  const backPath = getBackPath(screenToPath(currentScreen));
  return backPath ? pathToRoute(backPath) : null;
}
