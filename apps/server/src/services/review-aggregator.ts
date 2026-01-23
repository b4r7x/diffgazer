import type { ReviewResult, FileReviewResult, ReviewIssue } from "@repo/schemas/review";

export interface AggregationResult {
  result: ReviewResult;
  fileResults: FileReviewResult[];
  partialFailures: Array<{ file: string; error: string }>;
}

/** Combines file reviews into overall result. Parse errors tracked separately. */
export function aggregateReviews(
  fileResults: FileReviewResult[],
  partialFailures: Array<{ file: string; error: string }>
): AggregationResult {
  const allIssues: ReviewIssue[] = [];
  const scores: number[] = [];
  const parseErrors: Array<{ file: string; error: string }> = [];

  for (const fileResult of fileResults) {
    if (fileResult.parseError) {
      parseErrors.push({
        file: fileResult.filePath,
        error: fileResult.parseErrorMessage ?? "Unknown parse error",
      });
      continue;
    }

    allIssues.push(...fileResult.issues);
    if (fileResult.score !== null) {
      scores.push(fileResult.score);
    }
  }

  const overallScore = scores.length > 0
    ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10
    : null;

  const summary = buildSummary(fileResults, partialFailures, parseErrors, allIssues);

  return {
    result: {
      summary,
      issues: allIssues,
      overallScore,
    },
    fileResults,
    partialFailures,
  };
}

function buildSummary(
  fileResults: FileReviewResult[],
  partialFailures: Array<{ file: string; error: string }>,
  parseErrors: Array<{ file: string; error: string }>,
  allIssues: ReviewIssue[]
): string {
  const successfulCount = fileResults.filter(r => !r.parseError).length;
  const totalAttempted = fileResults.length;
  const issueCount = allIssues.length;
  const criticalCount = allIssues.filter(i => i.severity === "critical").length;
  const warningCount = allIssues.filter(i => i.severity === "warning").length;

  let summary = `Reviewed ${successfulCount} file${successfulCount !== 1 ? "s" : ""} with ${issueCount} issue${issueCount !== 1 ? "s" : ""} found.`;

  if (criticalCount > 0 || warningCount > 0) {
    const parts: string[] = [];
    if (criticalCount > 0) parts.push(`${criticalCount} critical`);
    if (warningCount > 0) parts.push(`${warningCount} warning${warningCount !== 1 ? "s" : ""}`);
    summary += ` (${parts.join(", ")})`;
  }

  if (parseErrors.length > 0) {
    summary += ` WARNING: ${parseErrors.length} file${parseErrors.length !== 1 ? "s" : ""} had AI response parsing errors - review may be incomplete.`;
  }

  if (partialFailures.length > 0) {
    summary += ` Note: ${partialFailures.length} file${partialFailures.length !== 1 ? "s" : ""} could not be reviewed.`;
  }

  return summary;
}
