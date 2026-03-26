import { getBackTarget } from "@diffgazer/core/navigation";

export type BackTarget = "/" | "/settings";

export const SAFE_BACK_FALLBACK_ROUTE: BackTarget = "/";

export type BackAction =
  | { type: "none" }
  | { type: "history" }
  | { type: "navigate"; to: BackTarget };

export { getBackTarget };

export function resolveBackAction(pathname: string, canGoBack: boolean): BackAction {
  if (pathname === "/") {
    return { type: "none" };
  }

  const target = getBackTarget(pathname);
  if (target) {
    return { type: "navigate", to: target as BackTarget };
  }

  if (canGoBack) {
    return { type: "history" };
  }

  return { type: "navigate", to: SAFE_BACK_FALLBACK_ROUTE };
}
