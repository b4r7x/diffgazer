import type { MenuAction } from "../schemas/presentation/navigation.js";
import type { ActiveReviewSession, ReviewMode } from "../schemas/review/index.js";
import {
  isReviewStartAction,
  type MenuDisablingContext,
  type ReviewStartAction,
} from "./menu-disabling.js";

type ResumableMode = Extract<ReviewMode, "unstaged" | "staged">;

interface ResumableSession {
  reviewId: string;
  mode: ResumableMode;
}

type ResumableSessionCandidate = Pick<ActiveReviewSession, "reviewId" | "mode" | "startedAt">;

interface RankedResumableSession extends ResumableSession {
  startedAtTime: number;
}

function toRankedResumableSession(
  session: ResumableSessionCandidate | null | undefined,
): RankedResumableSession | null {
  if (!session || session.mode === "files") {
    return null;
  }

  return {
    reviewId: session.reviewId,
    mode: session.mode,
    startedAtTime: Date.parse(session.startedAt),
  };
}

export function selectResumableSession(
  unstagedSession: ResumableSessionCandidate | null | undefined,
  stagedSession: ResumableSessionCandidate | null | undefined,
): ResumableSession | null {
  const candidates = [unstagedSession, stagedSession]
    .map(toRankedResumableSession)
    .filter((session): session is RankedResumableSession => session !== null)
    .sort((a, b) => b.startedAtTime - a.startedAtTime);
  const newest = candidates[0];
  if (!newest) {
    return null;
  }
  return { reviewId: newest.reviewId, mode: newest.mode };
}

export type NavigableMenuAction = Extract<MenuAction, "history" | "settings" | "help">;

export type HomeMenuActivation =
  | { kind: "start-review"; mode: ResumableMode }
  | { kind: "pick-files" }
  | { kind: "resume" }
  | { kind: "navigate"; target: NavigableMenuAction }
  | { kind: "quit" }
  | { kind: "blocked-untrusted" }
  | { kind: "noop" };

const REVIEW_START_MODE: Record<ReviewStartAction, ResumableMode> = {
  "review-unstaged": "unstaged",
  "review-staged": "staged",
};

/**
 * Maps a menu action plus the home trust/session state to a single shared
 * activation decision. Each surface renders this decision in its own channel
 * (web toast vs TUI no-op for blocked-untrusted).
 */
export function resolveHomeMenuActivation(
  action: MenuAction,
  { isTrusted, hasResumableSession }: MenuDisablingContext,
): HomeMenuActivation {
  if (action === "quit") {
    return { kind: "quit" };
  }

  if (isReviewStartAction(action)) {
    if (!isTrusted) {
      return { kind: "blocked-untrusted" };
    }
    return { kind: "start-review", mode: REVIEW_START_MODE[action] };
  }

  if (action === "review-files") {
    return isTrusted ? { kind: "pick-files" } : { kind: "blocked-untrusted" };
  }

  if (action === "resume-review") {
    return isTrusted && hasResumableSession ? { kind: "resume" } : { kind: "noop" };
  }

  if (action === "history" || action === "settings" || action === "help") {
    return { kind: "navigate", target: action };
  }

  const _exhaustive: never = action;
  throw new Error(`Unhandled menu action: ${JSON.stringify(_exhaustive)}`);
}
