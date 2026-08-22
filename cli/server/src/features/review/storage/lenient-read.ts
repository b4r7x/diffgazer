import { LensStatSchema } from "@diffgazer/core/schemas/events";
import {
  calculateSeverityCounts,
  type ExecutionResult,
  ExecutionResultSchema,
  LensIdSchema,
  ParsedDiffSchema,
  ProfileIdSchema,
  type ReviewGitContext,
  ReviewGitContextSchema,
  type ReviewIssue,
  ReviewIssueSchema,
  ReviewMetadataSchema,
  ReviewSeveritySchema,
  type SavedReview,
  terminalOutcomeKeepsFindings,
} from "@diffgazer/core/schemas/review";
import { z } from "zod";
import { normalizeIssueLineFields } from "../engine/issues/normalization.js";

const CountFieldSchema = z.number().int().nonnegative();

interface SalvagedItems<T> {
  items: T[];
  droppedItemCount: number;
}

export interface ReviewSalvageDiagnostics {
  droppedIssueCount: number;
  /** The record carried a terminal execution the salvage could not recover. */
  droppedExecution: boolean;
}

// Older records may carry lens/profile ids the current closed enums reject.
// Coerce them to valid vocabulary (drop unknown lenses, null an unknown profile)
// so the strict metadata schema parses. New writes still go through the strict
// schema unchanged.
function coerceMetadataVocab(raw: unknown): unknown {
  if (typeof raw !== "object" || raw === null) return raw;
  const metadata = raw as Record<string, unknown>;
  const lenses = Array.isArray(metadata.lenses)
    ? metadata.lenses.filter((lens: unknown) => LensIdSchema.safeParse(lens).success)
    : metadata.lenses;
  const profile = ProfileIdSchema.safeParse(metadata.profile).success ? metadata.profile : null;
  return { ...metadata, lenses, profile };
}

function salvageItems<T>(
  raw: unknown,
  schema: z.ZodType<T>,
  transform: (item: T) => T,
): SalvagedItems<T> {
  if (!Array.isArray(raw)) return { items: [], droppedItemCount: 0 };
  const items: T[] = [];
  for (const candidate of raw) {
    const parsed = schema.safeParse(candidate);
    if (parsed.success) items.push(transform(parsed.data));
  }
  return { items, droppedItemCount: raw.length - items.length };
}

function salvageIssues(raw: unknown): SalvagedItems<ReviewIssue> {
  return salvageItems(raw, ReviewIssueSchema, normalizeIssueLineFields);
}

function withParsedOptional<T>(
  record: Record<string, unknown>,
  key: string,
  schema: z.ZodType<T>,
): Record<string, T> | Record<string, never> {
  const parsed = schema.safeParse(record[key]);
  return parsed.success ? { [key]: parsed.data } : {};
}

function normalizeIssues(issues: ReviewIssue[]): ReviewIssue[] {
  let changed = false;
  const normalized = issues.map((issue) => {
    const next = normalizeIssueLineFields(issue);
    if (next !== issue) changed = true;
    return next;
  });
  return changed ? normalized : issues;
}

export function normalizeSavedReviewLineFields(review: SavedReview): SavedReview {
  const issues = normalizeIssues(review.result.issues);
  if (issues === review.result.issues) return review;

  return {
    ...review,
    result: { ...review.result, issues },
  };
}

function salvageExecution(raw: unknown): ExecutionResult | undefined {
  const parsed = ExecutionResultSchema.safeParse(raw);
  if (parsed.success) return parsed.data;
  return undefined;
}

/**
 * History reads expose only the findings a review's terminal outcome can vouch
 * for. Records written before that policy — or hand-edited since — can carry
 * findings their outcome never earned, so they are dropped here.
 */
export function dropUntrustedFindings(review: SavedReview): SavedReview {
  if (!review.execution || terminalOutcomeKeepsFindings(review.execution.receipt.outcome)) {
    return review;
  }

  return {
    ...review,
    metadata: {
      ...review.metadata,
      issueCount: 0,
      blockerCount: 0,
      highCount: 0,
      mediumCount: 0,
      lowCount: 0,
      nitCount: 0,
    },
    result: { issues: [] },
    execution: ExecutionResultSchema.parse({
      receipt: review.execution.receipt,
      result: { issues: [] },
    }),
  };
}

/**
 * Salvages an immutable stored review whose strict-schema parse failed (e.g. a
 * 0.1.3-era record with line/evidence/vocabulary values the current write-side
 * schema rejects). Returns a structurally valid `SavedReview` for reads and
 * history listings, or `null` when the metadata cannot be read (the caller then
 * surfaces the original validation error or listing warning).
 */
export function lenientReadSavedReview(
  parsed: unknown,
): { item: SavedReview; diagnostics: ReviewSalvageDiagnostics } | null {
  if (typeof parsed !== "object" || parsed === null) return null;
  const record = parsed as Record<string, unknown>;

  if (typeof record.metadata !== "object" || record.metadata === null) return null;
  const metadataResult = ReviewMetadataSchema.safeParse(coerceMetadataVocab(record.metadata));
  if (!metadataResult.success) return null;

  const gitContextResult = ReviewGitContextSchema.safeParse(record.gitContext);
  const gitContext: ReviewGitContext = gitContextResult.success
    ? gitContextResult.data
    : { branch: null, commit: null, fileCount: 0, additions: 0, deletions: 0 };

  const result = (record.result ?? {}) as Record<string, unknown>;
  const salvagedIssues = salvageIssues(result.issues);
  const severityCounts = calculateSeverityCounts(salvagedIssues.items);

  const execution = salvageExecution(record.execution);
  const salvagedReview = normalizeSavedReviewLineFields({
    metadata: {
      ...metadataResult.data,
      issueCount: salvagedIssues.items.length,
      blockerCount: severityCounts.blocker,
      highCount: severityCounts.high,
      mediumCount: severityCounts.medium,
      lowCount: severityCounts.low,
      nitCount: severityCounts.nit,
    },
    result: {
      issues: salvagedIssues.items,
    },
    ...withParsedOptional(record, "diff", ParsedDiffSchema),
    gitContext,
    ...withParsedOptional(record, "lensStats", z.array(LensStatSchema)),
    ...withParsedOptional(record, "droppedDuplicates", CountFieldSchema),
    ...withParsedOptional(record, "droppedBelowThreshold", CountFieldSchema),
    ...withParsedOptional(record, "minSeverity", ReviewSeveritySchema),
    ...(execution ? { execution } : {}),
  });

  // A stored record keeps its terminal execution in `executionSnapshot`; neither
  // half survives here unless it parses, so the outcome and trace are gone from
  // the salvaged read and the caller has to say so.
  const droppedExecution =
    execution === undefined &&
    (record.execution !== undefined || record.executionSnapshot !== undefined);

  return {
    item: dropUntrustedFindings(salvagedReview),
    diagnostics: { droppedIssueCount: salvagedIssues.droppedItemCount, droppedExecution },
  };
}
