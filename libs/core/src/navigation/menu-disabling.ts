import type { MenuAction } from "../schemas/presentation/navigation.js";

export interface MenuDisablingContext {
  isTrusted: boolean;
  hasResumableSession: boolean;
}

export type ReviewStartAction = Extract<MenuAction, "review-unstaged" | "review-staged">;

const REVIEW_START_ACTIONS: ReadonlySet<MenuAction> = new Set<MenuAction>([
  "review-unstaged",
  "review-staged",
]);

export function isReviewStartAction(id: MenuAction): id is ReviewStartAction {
  return REVIEW_START_ACTIONS.has(id);
}

export function isMenuActionDisabled(id: MenuAction, context: MenuDisablingContext): boolean {
  if (isReviewStartAction(id)) {
    return !context.isTrusted;
  }
  if (id === "resume-review") {
    return !context.isTrusted || !context.hasResumableSession;
  }
  return false;
}
