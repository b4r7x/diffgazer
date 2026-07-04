import { LensStatSchema } from "@diffgazer/core/schemas/events";
import {
  type DrilldownResult,
  DrilldownResultSchema,
  LensIdSchema,
  ProfileIdSchema,
  type ReviewGitContext,
  ReviewGitContextSchema,
  type ReviewIssue,
  ReviewIssueSchema,
  ReviewMetadataSchema,
  ReviewSeveritySchema,
  type SavedReview,
} from "@diffgazer/core/schemas/review";
import { z } from "zod";
import { normalizeIssueLineFields } from "../engine/issues.js";

const CountFieldSchema = z.number().int().nonnegative();

const DiffStatsSchema = z.object({
  additions: CountFieldSchema,
  deletions: CountFieldSchema,
  sizeBytes: CountFieldSchema,
});

const DiffHunkSchema = z.object({
  oldStart: CountFieldSchema,
  oldCount: CountFieldSchema,
  newStart: CountFieldSchema,
  newCount: CountFieldSchema,
  content: z.string(),
});

const FileDiffSchema = z.object({
  filePath: z.string(),
  previousPath: z.string().nullable(),
  operation: z.enum(["add", "modify", "delete", "rename"]),
  hunks: z.array(DiffHunkSchema),
  rawDiff: z.string(),
  stats: DiffStatsSchema,
});

const ParsedDiffSchema = z.object({
  files: z.array(FileDiffSchema),
  totalStats: z.object({
    filesChanged: CountFieldSchema,
    additions: CountFieldSchema,
    deletions: CountFieldSchema,
    totalSizeBytes: CountFieldSchema,
  }),
});

// Older records may carry lens/profile ids the current closed enums reject.
// Coerce them to valid vocabulary (drop unknown lenses, null an unknown profile)
// so the strict metadata schema parses and the record opens/deletes. New writes
// still go through the strict schema unchanged.
export function coerceMetadataVocab(raw: unknown): unknown {
  if (typeof raw !== "object" || raw === null) return raw;
  const metadata = raw as Record<string, unknown>;
  const lenses = Array.isArray(metadata.lenses)
    ? metadata.lenses.filter((lens: unknown) => LensIdSchema.safeParse(lens).success)
    : metadata.lenses;
  const profile = ProfileIdSchema.safeParse(metadata.profile).success ? metadata.profile : null;
  return { ...metadata, lenses, profile };
}

function salvageIssues(raw: unknown): ReviewIssue[] {
  if (!Array.isArray(raw)) return [];
  const issues: ReviewIssue[] = [];
  for (const candidate of raw) {
    const parsed = ReviewIssueSchema.safeParse(candidate);
    if (parsed.success) issues.push(normalizeIssueLineFields(parsed.data));
  }
  return issues;
}

function salvageDrilldowns(raw: unknown): DrilldownResult[] {
  if (!Array.isArray(raw)) return [];
  const drilldowns: DrilldownResult[] = [];
  for (const candidate of raw) {
    const parsed = DrilldownResultSchema.safeParse(candidate);
    if (parsed.success) {
      drilldowns.push({
        ...parsed.data,
        issue: normalizeIssueLineFields(parsed.data.issue),
      });
    }
  }
  return drilldowns;
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

function normalizeDrilldowns(drilldowns: DrilldownResult[]): DrilldownResult[] {
  let changed = false;
  const normalized = drilldowns.map((drilldown) => {
    const issue = normalizeIssueLineFields(drilldown.issue);
    if (issue === drilldown.issue) return drilldown;
    changed = true;
    return { ...drilldown, issue };
  });
  return changed ? normalized : drilldowns;
}

export function normalizeSavedReviewLineFields(review: SavedReview): SavedReview {
  const issues = normalizeIssues(review.result.issues);
  const drilldowns = normalizeDrilldowns(review.drilldowns);

  if (issues === review.result.issues && drilldowns === review.drilldowns) return review;

  return {
    ...review,
    result: { ...review.result, issues },
    drilldowns,
  };
}

/**
 * Salvages an immutable stored review whose strict-schema parse failed (e.g. a
 * 0.1.3-era record with line/evidence/vocabulary values the current write-side
 * schema rejects). Returns a structurally valid `SavedReview` so GET opens it and
 * DELETE's ownership read succeeds, or `null` when the metadata cannot be read
 * (the caller then surfaces the original validation error / listing warning).
 */
export function lenientReadSavedReview(parsed: unknown): SavedReview | null {
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

  return normalizeSavedReviewLineFields({
    metadata: metadataResult.data,
    result: {
      summary: typeof result.summary === "string" ? result.summary : "",
      issues: salvageIssues(result.issues),
    },
    ...withParsedOptional(record, "diff", ParsedDiffSchema),
    gitContext,
    drilldowns: salvageDrilldowns(record.drilldowns),
    ...withParsedOptional(record, "lensStats", z.array(LensStatSchema)),
    ...withParsedOptional(record, "droppedDuplicates", CountFieldSchema),
    ...withParsedOptional(record, "droppedBelowThreshold", CountFieldSchema),
    ...withParsedOptional(record, "minSeverity", ReviewSeveritySchema),
  });
}
