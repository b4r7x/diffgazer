import type { BackTarget } from "@diffgazer/core/navigation";
import { getBackTarget } from "@diffgazer/core/navigation";
import type { AnyRouter } from "@tanstack/react-router";

const SAFE_BACK_FALLBACK_ROUTE: BackTarget = "/";

export type BackAction =
  | { type: "none" }
  | { type: "history" }
  | { type: "navigate"; to: BackTarget };

// Home is the root, and onboarding has nowhere to go back to: a back link there
// would loop the unconfigured user straight into the wizard again.
const ROUTES_WITHOUT_BACK = new Set(["/", "/onboarding"]);

export function resolveBackAction(pathname: string, canGoBack: boolean): BackAction {
  if (ROUTES_WITHOUT_BACK.has(pathname)) {
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

export function performBackAction(router: AnyRouter, action: BackAction): void {
  if (action.type === "navigate") {
    void router.navigate({ to: action.to });
    return;
  }

  if (action.type === "history") {
    router.history.back();
  }
}
