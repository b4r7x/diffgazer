import type { MenuAction } from "../schemas/presentation/navigation.js";
import type { ReviewMode } from "../schemas/review/index.js";
import { isReviewStartAction } from "./menu-disabling.js";

type ResumableMode = Extract<ReviewMode, "unstaged" | "staged">;

interface ResumableSession {
  reviewId: string;
  mode: ResumableMode;
}

interface ResumableSessionCandidate {
  reviewId: string;
  mode: string;
  startedAt?: string;
}

interface RankedResumableSession extends ResumableSession {
  startedAtTime: number;
}

function toRankedResumableSession(
  session: ResumableSessionCandidate | null | undefined,
): RankedResumableSession | null {
  if (!session || (session.mode !== "unstaged" && session.mode !== "staged")) {
    return null;
  }

  const startedAtTime = session.startedAt ? Date.parse(session.startedAt) : 0;
  return {
    reviewId: session.reviewId,
    mode: session.mode,
    startedAtTime: Number.isNaN(startedAtTime) ? 0 : startedAtTime,
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
