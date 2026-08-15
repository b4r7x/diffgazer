import { buildRunIdLookup, formatRunId, type RunIdLookup } from "../../format.js";
import type { ReviewListWarning } from "../../schemas/review/index.js";
import { pluralize } from "../../strings.js";

export interface HistoryWarningSummary {
  unreadableReviewCount: number;
  unreadableReviewIds: string[];
  droppedIssueCount: number;
  droppedIssueReviewIds: string[];
  droppedExecutionReviewIds: string[];
  indexBuildFailed: boolean;
  indexRewriteFailed: boolean;
}

export interface HistoryWarningMessageOptions {
  /** Keep terminal copy bounded while retaining the total target count. */
  maxTargetIds?: number;
}

/** Default `maxTargetIds` for surfaces that show a sample of affected runs inline. */
export const HISTORY_WARNING_TARGET_SAMPLE_SIZE = 3;

export function summarizeHistoryWarnings(
  warnings: readonly ReviewListWarning[],
): HistoryWarningSummary {
  const summary: HistoryWarningSummary = {
    unreadableReviewCount: 0,
    unreadableReviewIds: [],
    droppedIssueCount: 0,
    droppedIssueReviewIds: [],
    droppedExecutionReviewIds: [],
    indexBuildFailed: false,
    indexRewriteFailed: false,
  };

  for (const warning of warnings) {
    switch (warning.kind) {
      case "unreadable_review":
        summary.unreadableReviewCount += 1;
        summary.unreadableReviewIds.push(warning.reviewId);
        break;
      case "invalid_issues_dropped":
        summary.droppedIssueCount += warning.count;
        summary.droppedIssueReviewIds.push(warning.reviewId);
        break;
      case "invalid_execution_dropped":
        summary.droppedExecutionReviewIds.push(warning.reviewId);
        break;
      case "index_build_failed":
        summary.indexBuildFailed = true;
        break;
      case "index_rewrite_failed":
        summary.indexRewriteFailed = true;
        break;
      default: {
        const _exhaustive: never = warning;
        throw new Error(`Unhandled history warning: ${JSON.stringify(_exhaustive)}`);
      }
    }
  }

  return summary;
}

function uniqueReviewIds(ids: readonly string[]): string[] {
  return [...new Set(ids)];
}

export function getHistoryWarningTargetIds(summary: HistoryWarningSummary): string[] {
  return uniqueReviewIds([
    ...summary.unreadableReviewIds,
    ...summary.droppedIssueReviewIds,
    ...summary.droppedExecutionReviewIds,
  ]);
}

function formatReviewIds(
  ids: readonly string[],
  runIdLookup: RunIdLookup,
  maxTargetIds?: number,
): string {
  const uniqueIds = uniqueReviewIds(ids);
  const visibleIds =
    maxTargetIds === undefined ? uniqueIds : uniqueIds.slice(0, Math.max(maxTargetIds, 1));
  const labels = visibleIds.map((id) => runIdLookup.get(id) ?? formatRunId(id));
  const hiddenCount = uniqueIds.length - visibleIds.length;
  return hiddenCount > 0 ? `${labels.join(", ")}, … +${hiddenCount} more` : labels.join(", ");
}

export function buildHistoryWarningMessages(
  summary: HistoryWarningSummary,
  runIdLookup?: RunIdLookup,
  options: HistoryWarningMessageOptions = {},
): string[] {
  const messages: string[] = [];
  // Without the caller's lookup the warning targets are their own peer set, which is enough
  // to keep the ids in this copy distinct from each other.
  const lookup = runIdLookup ?? buildRunIdLookup(getHistoryWarningTargetIds(summary));

  if (summary.unreadableReviewCount > 0) {
    const reviewIds = formatReviewIds(summary.unreadableReviewIds, lookup, options.maxTargetIds);
    const identifier = reviewIds ? ` (${reviewIds})` : "";
    messages.push(
      `${pluralize(summary.unreadableReviewCount, "saved review")}${identifier} could not be read.`,
    );
  }
  if (summary.droppedIssueCount > 0) {
    const issueCount = pluralize(summary.droppedIssueCount, "invalid saved issue");
    const verb = summary.droppedIssueCount === 1 ? "was" : "were";
    const affectedReviewIds = uniqueReviewIds(summary.droppedIssueReviewIds);
    const reviewIds = formatReviewIds(affectedReviewIds, lookup, options.maxTargetIds);
    const affectedReviews = reviewIds ? ` from ${reviewIds}` : "";
    messages.push(
      `${issueCount} ${verb} omitted${affectedReviews}. Re-run the affected reviews for complete results.`,
    );
  }
  if (summary.droppedExecutionReviewIds.length > 0) {
    const affectedReviewIds = uniqueReviewIds(summary.droppedExecutionReviewIds);
    const reviewIds = formatReviewIds(affectedReviewIds, lookup, options.maxTargetIds);
    const affectedReviews = reviewIds ? ` (${reviewIds})` : "";
    messages.push(
      `Execution details for ${pluralize(affectedReviewIds.length, "saved review")}${affectedReviews} could not be read. Re-run the affected reviews to restore the outcome and trace.`,
    );
  }
  if (summary.indexBuildFailed) {
    messages.push(
      "The history index could not be rebuilt. Readable reviews are still shown; reopen History to retry.",
    );
  }
  if (summary.indexRewriteFailed) {
    messages.push(
      "The history index could not be cleaned up. Readable reviews are still shown; reopen History to retry.",
    );
  }

  return messages;
}
