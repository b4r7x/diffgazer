import { resolveHomeMenuActivation } from "@diffgazer/core/navigation";
import type { MenuAction } from "@diffgazer/core/schemas/presentation";
import type { UseMutationResult } from "@tanstack/react-query";
import type { Route } from "../../../lib/routes";

type RouteReviewMode = Extract<Route, { screen: "review" }>["mode"];

export interface ActiveSessionInfo {
  reviewId: string;
  mode: NonNullable<RouteReviewMode>;
}

export interface HomeMenuActionOptions {
  navigate: (route: Route) => void;
  hasActiveSession: boolean;
  activeSession?: ActiveSessionInfo | null;
  isTrusted?: boolean;
  shutdown: Pick<UseMutationResult<unknown, unknown, void, unknown>, "mutate">;
  onExit: () => void;
}

export function createHomeMenuAction({
  navigate,
  hasActiveSession,
  activeSession,
  isTrusted = false,
  shutdown,
  onExit,
}: HomeMenuActionOptions): (action: MenuAction) => void {
  return (action: MenuAction) => {
    const decision = resolveHomeMenuActivation(action, {
      isTrusted,
      hasResumableSession: hasActiveSession,
    });

    switch (decision.kind) {
      case "start-review":
        navigate({ screen: "review", mode: decision.mode });
        return;
      case "resume":
        if (activeSession) {
          navigate({
            screen: "review",
            reviewId: activeSession.reviewId,
            mode: activeSession.mode,
            live: true,
          });
        } else {
          navigate({ screen: "review" });
        }
        return;
      case "navigate":
        navigate({ screen: decision.target });
        return;
      case "quit":
        shutdown.mutate(undefined, {
          onSettled: () => onExit(),
        });
        return;
      // The TUI renders blocked-untrusted as a no-op (the menu item is disabled).
      case "blocked-untrusted":
      case "noop":
        return;
      default: {
        const _exhaustive: never = decision;
        return _exhaustive;
      }
    }
  };
}
