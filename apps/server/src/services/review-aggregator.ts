import type { ReviewResult, FileReviewResult, ReviewIssue } from "@repo/schemas/review";

export interface AggregationResult {
  result: ReviewResult;
  fileResults: FileReviewResult[];
  partialFailures: Array<{ file: string; error: string }>;
}

/**
 * Aggregates multiple file-level review results into a single overall review.
 * Combines issues from all files, computes overall score, and generates summary.
 * Tracks parse errors separately from complete failures to surface degraded results.
 */
export function aggregateReviews(
  fileResults: FileReviewResult[],
  partialFailures: Array<{ file: string; error: string }>
): AggregationResult {
  const allIssues: ReviewIssue[] = [];
  const scores: number[] = [];
  const parseErrors: Array<{ file: string; error: string }> = [];

  for (const fileResult of fileResults) {
    // Track files with parse errors separately - their issues array is unreliable
    if (fileResult.parseError) {
      parseErrors.push({
        file: fileResult.filePath,
        error: fileResult.parseErrorMessage ?? "Unknown parse error",
      });
      // Do NOT include issues from parse-errored results - they are empty/unreliable
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

  // Surface parse errors prominently - these indicate degraded results
  if (parseErrors.length > 0) {
    summary += ` WARNING: ${parseErrors.length} file${parseErrors.length !== 1 ? "s" : ""} had AI response parsing errors - review may be incomplete.`;
  }

  if (partialFailures.length > 0) {
    summary += ` Note: ${partialFailures.length} file${partialFailures.length !== 1 ? "s" : ""} could not be reviewed.`;
  }

  return summary;
}
