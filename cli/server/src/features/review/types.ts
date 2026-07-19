import type { FullReviewStreamEvent, LensStat } from "@diffgazer/core/schemas/events";
import type {
  LensId,
  ProfileId,
  ReviewIssue,
  ReviewMode,
  ReviewSeverity,
  SeverityFilter,
} from "@diffgazer/core/schemas/review";
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

export interface ReviewOutcome {
  issues: ReviewIssue[];
  lensStats?: LensStat[];
  droppedDuplicates?: number;
  droppedBelowThreshold?: number;
  minSeverity?: ReviewSeverity;
}
