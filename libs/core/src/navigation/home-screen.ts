import type { MenuAction } from "../schemas/presentation/navigation.js";
import type { ReviewMode } from "../schemas/review/index.js";
import { isReviewStartAction } from "./menu-disabling.js";

type ResumableMode = Extract<ReviewMode, "unstaged" | "staged">;

interface ResumableSession {
  reviewId: string;
  mode: ResumableMode;
}

/**
 * Selects the session to resume, preferring the unstaged session over the
 * staged one and validating that the reported mode is a known review mode.
 */
export function selectResumableSession(
  unstagedSession: { reviewId: string; mode: string } | null | undefined,
  stagedSession: { reviewId: string; mode: string } | null | undefined,
): ResumableSession | null {
  const preferred = unstagedSession ?? stagedSession;
  if (!preferred) {
    return null;
  }
  return preferred.mode === "unstaged" || preferred.mode === "staged"
    ? { reviewId: preferred.reviewId, mode: preferred.mode }
    : null;
}

export type NavigableMenuAction = Extract<MenuAction, "history" | "settings" | "help">;

export type HomeMenuActivation =
  | { kind: "start-review"; mode: ResumableMode }
  | { kind: "resume" }
  | { kind: "navigate"; target: NavigableMenuAction }
  | { kind: "quit" }
  | { kind: "blocked-untrusted" }
  | { kind: "noop" };

const REVIEW_START_MODE: Partial<Record<MenuAction, ResumableMode>> = {
  "review-unstaged": "unstaged",
  "review-staged": "staged",
};

interface HomeMenuActivationContext {
  isTrusted: boolean;
  hasResumableSession: boolean;
}

/**
 * Maps a menu action plus the home trust/session state to a single shared
 * activation decision. Each surface renders this decision in its own channel
 * (web toast vs TUI no-op for blocked-untrusted).
 */
export function resolveHomeMenuActivation(
  action: MenuAction,
  { isTrusted, hasResumableSession }: HomeMenuActivationContext,
): HomeMenuActivation {
  if (action === "quit") {
    return { kind: "quit" };
  }

  if (isReviewStartAction(action)) {
    if (!isTrusted) {
      return { kind: "blocked-untrusted" };
    }
    const mode = REVIEW_START_MODE[action];
    return mode ? { kind: "start-review", mode } : { kind: "noop" };
  }

  if (action === "resume-review") {
    return isTrusted && hasResumableSession ? { kind: "resume" } : { kind: "noop" };
  }

  if (action === "history" || action === "settings" || action === "help") {
    return { kind: "navigate", target: action };
  }

  return { kind: "noop" };
}
