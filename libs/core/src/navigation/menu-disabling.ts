import type { MenuAction } from "../schemas/ui/navigation.js";

export interface MenuDisablingContext {
  isTrusted: boolean;
  hasResumableSession: boolean;
}

const REVIEW_START_ACTIONS = new Set<MenuAction>([
  "review-unstaged",
  "review-staged",
  "review-files",
]);

export function isReviewStartAction(id: MenuAction): boolean {
  return REVIEW_START_ACTIONS.has(id);
}

export function isReviewAction(id: MenuAction): boolean {
  return REVIEW_START_ACTIONS.has(id) || id === "resume-review";
}

export function isMenuActionDisabled(
  id: MenuAction,
  context: MenuDisablingContext
): boolean {
  if (isReviewStartAction(id)) {
    return !context.isTrusted;
  }
  if (id === "resume-review") {
    return !context.isTrusted || !context.hasResumableSession;
  }
  return false;
}
