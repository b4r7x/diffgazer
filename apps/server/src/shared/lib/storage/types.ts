import type { ZodType } from "zod";
import type { Result } from "@stargazer/core/result";
import type { AppError } from "@stargazer/core/errors";
import type { ReviewResult, LensId, ProfileId, DrilldownResult, ReviewMode } from "@stargazer/schemas/review";
import type { ParsedDiff } from "../diff/types.js";

export type StoreErrorCode =
  | "NOT_FOUND"
  | "PARSE_ERROR"
  | "VALIDATION_ERROR"
  | "WRITE_ERROR"
  | "PERMISSION_ERROR";

export type StoreError = AppError<StoreErrorCode>;

export interface CollectionConfig<T, M> {
  name: string;
  dir: string;
  filePath: (id: string) => string;
  schema: ZodType<T>;
  getMetadata: (item: T) => M;
  getId: (item: T) => string;
  metadataSchema?: ZodType<M>;
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
}
