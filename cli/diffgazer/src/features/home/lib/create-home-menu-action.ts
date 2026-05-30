import type { UseMutationResult } from "@tanstack/react-query";
import type { MenuAction } from "@diffgazer/core/schemas/presentation";
import { isReviewStartAction } from "@diffgazer/core/navigation";
import type { Route } from "../../../app/routes";

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
}: HomeMenuActionOptions): (action: string) => void {
  return (action: string) => {
    const menuAction = action as MenuAction;

    if (isReviewStartAction(menuAction) && !isTrusted) {
      return;
    }

    switch (menuAction) {
      case "review-unstaged":
        navigate({ screen: "review", mode: "unstaged" });
        return;
      case "review-staged":
        navigate({ screen: "review", mode: "staged" });
        return;
      case "review-files":
        return;
      case "resume-review":
        if (hasActiveSession && activeSession) {
          navigate({
            screen: "review",
            reviewId: activeSession.reviewId,
            mode: activeSession.mode,
          });
        } else if (hasActiveSession) {
          navigate({ screen: "review" });
        }
        return;
      case "history":
        navigate({ screen: "history" });
        return;
      case "settings":
        navigate({ screen: "settings" });
        return;
      case "help":
        navigate({ screen: "help" });
        return;
      case "quit":
        shutdown.mutate(undefined, {
          onSettled: () => onExit(),
        });
        return;
    }
  };
}
