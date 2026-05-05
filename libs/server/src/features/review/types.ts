import type { FullReviewStreamEvent, StepId } from "@diffgazer/core/schemas/events";
import type { LensId, ProfileId, ReviewIssue, ReviewMode } from "@diffgazer/core/schemas/review";
import type { ErrorCode } from "@diffgazer/core/schemas/errors";
import type { AIError } from "../../shared/lib/ai/types.js";
import type { StoreError } from "../../shared/lib/storage/types.js";
import type { getProfile } from "../../shared/lib/review/profiles.js";

export type { ActiveSession } from "./sessions.js";

export type EmitFn = (event: FullReviewStreamEvent) => Promise<void>;

export interface StreamReviewParams {
  mode?: ReviewMode;
  files?: string[];
  lenses?: LensId[];
  profile?: ProfileId;
  projectPath?: string;
}

/** Review pipeline resolved config (lenses + profile). @see cli/add/src/context.ts for CLI-specific variants. */
export interface ResolvedConfig {
  activeLenses: LensId[];
  profile: ReturnType<typeof getProfile> | undefined;
  projectContext: string;
}

export interface ReviewOutcome {
  issues: ReviewIssue[];
  summary: string;
}

export interface ReviewAbort {
  readonly kind: "review_abort";
  readonly message: string;
  readonly code: string;
  readonly step?: StepId;
}

export type DrilldownError =
  | AIError
  | { code: "ISSUE_NOT_FOUND"; message: string };

export type HandleDrilldownError =
  | DrilldownError
  | StoreError
  | { code: typeof ErrorCode.COMMAND_FAILED; message: string };
