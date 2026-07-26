import type { AppError } from "@diffgazer/core/errors";
import type { LensStat } from "@diffgazer/core/schemas/events";
import type {
  LensId,
  ProfileId,
  ReviewMode,
  ReviewResult,
  ReviewSeverity,
} from "@diffgazer/core/schemas/review";
import type { StoreErrorCode } from "../../../shared/lib/http/error-codes.js";
import type { ParsedDiff } from "../engine/diff/types.js";

export type { StoreErrorCode };

export type StoreError = AppError<StoreErrorCode>;

export type DateFieldsOf<T> = {
  [K in keyof T]: T[K] extends string ? K : never;
}[keyof T];

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
}
