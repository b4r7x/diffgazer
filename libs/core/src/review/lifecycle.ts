import type { StepId, StepState } from "../schemas/events/index.js";
import { ReviewErrorCode } from "../schemas/review/index.js";

const SESSION_TERMINATION_CODES = [
  ReviewErrorCode.SESSION_STALE,
  ReviewErrorCode.SESSION_EVICTED,
  ReviewErrorCode.SESSION_TIMEOUT,
  ReviewErrorCode.SERVER_SHUTDOWN,
] as const satisfies readonly ReviewErrorCode[];

/** Terminal session error codes the resume path surfaces to the user. */
export type SessionTerminationCode = (typeof SESSION_TERMINATION_CODES)[number];

export interface SessionTerminationCopy {
  title: string;
  message: string;
}

/**
 * Maps a terminal session code to cause-accurate copy. The shutdown message must
 * NOT suggest starting a new review, because the server is going away and an
 * immediate retry would also fail; the other causes are recoverable by retrying.
 */
export function sessionTerminationCopy(code: SessionTerminationCode): SessionTerminationCopy {
  switch (code) {
    case ReviewErrorCode.SESSION_EVICTED:
      return {
        title: "Session Evicted",
        message:
          "This review was dropped to make room for newer reviews. Start it again to continue.",
      };
    case ReviewErrorCode.SESSION_TIMEOUT:
      return {
        title: "Session Timed Out",
        message:
          "The review session timed out after a long period without activity. Start a new review to retry.",
      };
    case ReviewErrorCode.SERVER_SHUTDOWN:
      return {
        title: "Server Stopped",
        message: "The review was interrupted because the diffgazer server is shutting down.",
      };
    case ReviewErrorCode.SESSION_STALE:
      return {
        title: "Session Expired",
        message: "The review session has become stale. Please start a new review.",
      };
    default: {
      const _exhaustive: never = code;
      return _exhaustive;
    }
  }
}

const SESSION_TERMINATION_CODE_SET: ReadonlySet<string> = new Set(SESSION_TERMINATION_CODES);

/** True when a resume error code is a terminal session cause carrying cause-accurate copy. */
export function isSessionTerminationCode(code: string): code is SessionTerminationCode {
  return SESSION_TERMINATION_CODE_SET.has(code);
}

/**
 * Context is best-effort: its failure downgrades the review but never ends it.
 * Every other step failure is terminal, and the log presentation must agree with
 * the reducer on that split.
 */
export function isFatalStepFailure(step: StepId): boolean {
  return step !== "context";
}

export function isNoDiffError(errorCode: string | null): boolean {
  return errorCode === ReviewErrorCode.NO_DIFF;
}

export function isCheckingForChanges(isStreaming: boolean, steps: StepState[]): boolean {
  const diffStep = steps.find((s) => s.id === "diff");
  return isStreaming && diffStep?.status !== "completed" && diffStep?.status !== "error";
}

export function getLoadingMessage(opts: {
  configLoading: boolean;
  settingsLoading: boolean;
  isCheckingForChanges: boolean;
  isInitializing: boolean;
}): string | null {
  if (opts.configLoading || opts.settingsLoading) return "Loading configuration...";
  if (opts.isCheckingForChanges || opts.isInitializing) return "Checking for changes...";
  return null;
}
