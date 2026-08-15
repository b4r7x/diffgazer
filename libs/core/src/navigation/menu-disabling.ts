import type { MenuAction } from "../schemas/presentation/navigation.js";

export interface MenuDisablingContext {
  isTrusted: boolean;
  hasResumableSession: boolean;
}

export type ReviewStartAction = Extract<MenuAction, "review-unstaged" | "review-staged">;

export function isReviewStartAction(id: MenuAction): id is ReviewStartAction {
  return id === "review-unstaged" || id === "review-staged";
}

/**
 * Every action states its own availability policy. The exhaustive switch makes a
 * new `MenuAction` fail type-check here rather than silently shipping enabled.
 */
export function isMenuActionDisabled(id: MenuAction, context: MenuDisablingContext): boolean {
  switch (id) {
    case "review-unstaged":
    case "review-staged":
      return !context.isTrusted;
    case "resume-review":
      return !context.isTrusted || !context.hasResumableSession;
    case "history":
    case "settings":
    case "help":
    case "quit":
      return false;
    default: {
      const _exhaustive: never = id;
      return _exhaustive;
    }
  }
}
