import type { ReviewListWarning } from "../../schemas/review/index.js";
import { pluralize } from "../../strings.js";

export interface HistoryWarningSummary {
  unreadableReviewCount: number;
  droppedIssueCount: number;
  indexBuildFailed: boolean;
  indexRewriteFailed: boolean;
}

export function summarizeHistoryWarnings(
  warnings: readonly ReviewListWarning[],
): HistoryWarningSummary {
  const summary: HistoryWarningSummary = {
    unreadableReviewCount: 0,
    droppedIssueCount: 0,
    indexBuildFailed: false,
    indexRewriteFailed: false,
  };

  for (const warning of warnings) {
    switch (warning.kind) {
      case "unreadable_review":
        summary.unreadableReviewCount += 1;
        break;
      case "invalid_issues_dropped":
        summary.droppedIssueCount += warning.count;
        break;
      case "index_build_failed":
        summary.indexBuildFailed = true;
        break;
      case "index_rewrite_failed":
        summary.indexRewriteFailed = true;
        break;
      default: {
        const unhandledWarning: never = warning;
        throw new Error(
          `Unhandled history warning kind: ${(unhandledWarning as { kind: string }).kind}`,
        );
      }
    }
  }

  return summary;
}

export function buildHistoryWarningMessages(summary: HistoryWarningSummary): string[] {
  const messages: string[] = [];

  if (summary.unreadableReviewCount > 0) {
    messages.push(`${pluralize(summary.unreadableReviewCount, "saved review")} could not be read.`);
  }
  if (summary.droppedIssueCount > 0) {
    const issueCount = pluralize(summary.droppedIssueCount, "invalid saved issue");
    const verb = summary.droppedIssueCount === 1 ? "was" : "were";
    messages.push(
      `${issueCount} ${verb} omitted. Re-run the affected reviews for complete results.`,
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
