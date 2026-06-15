import type { BackTarget } from "@diffgazer/core/navigation";
import { getBackTarget } from "@diffgazer/core/navigation";

export const SAFE_BACK_FALLBACK_ROUTE: BackTarget = "/";

export type BackAction =
  | { type: "none" }
  | { type: "history" }
  | { type: "navigate"; to: BackTarget };

export function resolveBackAction(pathname: string, canGoBack: boolean): BackAction {
  if (pathname === "/") {
    return { type: "none" };
  }

  const target = getBackTarget(pathname);
  if (target) {
    return { type: "navigate", to: target };
  }

  if (canGoBack) {
    return { type: "history" };
  }

  return { type: "navigate", to: SAFE_BACK_FALLBACK_ROUTE };
}
