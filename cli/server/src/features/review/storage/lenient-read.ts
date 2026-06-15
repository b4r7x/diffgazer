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
  type SavedReview,
} from "@diffgazer/core/schemas/review";
import { normalizeIssueLineFields } from "../engine/issues.js";

// Older records may carry lens/profile ids the current closed enums reject.
// Coerce them to valid vocabulary (drop unknown lenses, null an unknown profile)
// so the strict metadata schema parses and the record opens/deletes. New writes
// still go through the strict schema unchanged.
function coerceMetadataVocab(raw: Record<string, unknown>): Record<string, unknown> {
  const lenses = Array.isArray(raw.lenses)
    ? raw.lenses.filter((lens) => LensIdSchema.safeParse(lens).success)
    : raw.lenses;
  const profile = ProfileIdSchema.safeParse(raw.profile).success ? raw.profile : null;
  return { ...raw, lenses, profile };
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
  const metadataResult = ReviewMetadataSchema.safeParse(
    coerceMetadataVocab(record.metadata as Record<string, unknown>),
  );
  if (!metadataResult.success) return null;

  const gitContextResult = ReviewGitContextSchema.safeParse(record.gitContext);
  const gitContext: ReviewGitContext = gitContextResult.success
    ? gitContextResult.data
    : { branch: null, commit: null, fileCount: 0, additions: 0, deletions: 0 };

  const result = (record.result ?? {}) as Record<string, unknown>;

  return {
    metadata: metadataResult.data,
    result: {
      summary: typeof result.summary === "string" ? result.summary : "",
      issues: salvageIssues(result.issues),
    },
    gitContext,
    drilldowns: salvageDrilldowns(record.drilldowns),
  };
}
