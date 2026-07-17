import type { AppError } from "@diffgazer/core/errors";
import type { Result } from "@diffgazer/core/result";
import type { LensStat } from "@diffgazer/core/schemas/events";
import type {
  DrilldownResult,
  LensId,
  ProfileId,
  ReviewMode,
  ReviewResult,
  ReviewSeverity,
} from "@diffgazer/core/schemas/review";
import type { ZodType } from "zod";
import type { StoreErrorCode } from "../../../shared/lib/http/error-codes.js";
import type { ParsedDiff } from "../engine/diff/types.js";

export type { StoreErrorCode };

export type StoreError = AppError<StoreErrorCode>;

export interface LenientReadResult<T, D> {
  item: T;
  diagnostics: D;
}

export interface CollectionConfig<T, M, D = never> {
  name: string;
  dir: string;
  filePath: (id: string) => string;
  schema: ZodType<T>;
  getMetadata: (item: T) => M;
  getId: (item: T) => string;
  metadataSchema?: ZodType<M>;
  /**
   * Salvage an immutable stored record whose strict-schema parse failed (e.g. an
   * older-version review with line/evidence/vocab values the current write-side
   * schema rejects). Receives the parsed JSON; returns the recovered record with
   * typed diagnostics, or `null` when nothing usable can be recovered. Strict
   * validation still governs new writes — this only loosens the read path so old
   * records open and delete.
   */
  lenientRead?: (parsed: unknown) => LenientReadResult<T, D> | null;
}

export interface Collection<T, M> {
  ensureDir(): Promise<Result<void, StoreError>>;
  read(id: string): Promise<Result<T, StoreError>>;
  write(item: T): Promise<Result<void, StoreError>>;
  list(): Promise<Result<{ items: M[]; warnings: string[] }, StoreError>>;
  remove(id: string): Promise<Result<{ existed: boolean }, StoreError>>;
}

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
  drilldowns?: DrilldownResult[];
  durationMs?: number;
  lensStats?: LensStat[];
  droppedDuplicates?: number;
  droppedBelowThreshold?: number;
  minSeverity?: ReviewSeverity;
}
