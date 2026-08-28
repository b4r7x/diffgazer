import type { AppError } from "@diffgazer/core/errors";
import type { LensStat } from "@diffgazer/core/schemas/events";
import type {
  ExecutionResult,
  LensId,
  ProfileId,
  ReviewMode,
  ReviewResult,
  ReviewSeverity,
  TerminalOutcome,
} from "@diffgazer/core/schemas/review";
import type { StoreErrorCode } from "../../../shared/lib/http/error-codes.js";
import type { ParsedDiff } from "../engine/diff/types.js";

export type { StoreErrorCode };

export type StoreError = AppError<StoreErrorCode>;

export interface SaveReviewOptions {
  reviewId?: string;
  projectPath: string;
  mode: ReviewMode;
  result: ReviewResult;
  diff: ParsedDiff;
  branch: string | null;
  commit: string | null;
  profile?: ProfileId;
  lenses: LensId[];
  durationMs?: number;
  lensStats?: LensStat[];
  droppedDuplicates?: number;
  droppedBelowThreshold?: number;
  minSeverity?: ReviewSeverity;
  execution?: ExecutionResult;
  /**
   * The outcome of a run that ended without an execution receipt — the partial
   * write a terminated session leaves behind. A receipt, when there is one,
   * still names the outcome itself.
   */
  terminalOutcome?: TerminalOutcome;
}
