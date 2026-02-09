export type BackTarget = "/" | "/settings";

export const SAFE_BACK_FALLBACK_ROUTE: BackTarget = "/";

export type BackAction =
  | { type: "none" }
  | { type: "history" }
  | { type: "navigate"; to: BackTarget };

export function getBackTarget(pathname: string): BackTarget | null {
  if (pathname === "/settings" || pathname === "/settings/") {
    return "/";
  }

  if (pathname.startsWith("/settings/")) {
    return "/settings";
  }

  return null;
}

export function resolveBackAction(pathname: string, canGoBack: boolean): BackAction {
  if (pathname === "/") {
    return { type: "none" };
  }

  const settingsTarget = getBackTarget(pathname);
  if (settingsTarget) {
    return { type: "navigate", to: settingsTarget };
  }

  if (canGoBack) {
    return { type: "history" };
  }

  return { type: "navigate", to: SAFE_BACK_FALLBACK_ROUTE };
}
