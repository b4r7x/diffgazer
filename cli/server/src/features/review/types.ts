import type { FullReviewStreamEvent, LensStat } from "@diffgazer/core/schemas/events";
import type {
  ExecutionResult,
  LensId,
  ProfileId,
  ReviewIssue,
  ReviewMode,
  ReviewSeverity,
  SeverityFilter,
} from "@diffgazer/core/schemas/review";
import type { AuthorizedReviewExecution } from "../../shared/lib/ai/admission/service.js";
import type { getProfile } from "./engine/profiles.js";

export type EmitFn = (event: FullReviewStreamEvent) => Promise<void>;

export interface StreamReviewParams {
  mode?: ReviewMode;
  files?: string[];
  lenses?: LensId[];
  profile?: ProfileId;
  projectPath?: string;
}

/** Review pipeline resolved config (lenses + profile). @see cli/add/src/context.ts for CLI-specific variants. */
export interface ResolvedReviewDefaults {
  activeLenses: LensId[];
  effectiveProfileId?: ProfileId;
  profile: ReturnType<typeof getProfile> | undefined;
  severityFilter?: SeverityFilter;
  concurrency: number;
}

export interface ResolvedConfig extends ResolvedReviewDefaults {
  projectContext: string;
}

/**
 * Immutable admitted plan, lease, and budget reservation carried through review
 * execution and finalization. Release exactly once on every terminal path.
 */
export type ReviewExecutionContext = Readonly<{
  authorization: AuthorizedReviewExecution;
  releaseOnce: () => void;
}>;

export function createReviewExecutionContext(
  authorization: AuthorizedReviewExecution,
): ReviewExecutionContext {
  let released = false;
  return Object.freeze({
    authorization,
    releaseOnce: () => {
      if (released) return;
      released = true;
      authorization.release();
    },
  });
}

export interface ReviewOutcome {
  issues: ReviewIssue[];
  lensStats?: LensStat[];
  droppedDuplicates?: number;
  droppedBelowThreshold?: number;
  minSeverity?: ReviewSeverity;
  execution?: ExecutionResult;
}
