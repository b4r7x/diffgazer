import type { ReviewIssue, EnrichmentData } from "@stargazer/schemas/review";
import type { EnrichProgressEvent } from "@stargazer/schemas/events";

const CONTEXT_LINES = 5;

export interface EnrichGitService {
  getBlame(
    file: string,
    line: number,
  ): Promise<{
    author: string;
    authorEmail: string;
    commit: string;
    commitDate: string;
    summary: string;
  } | null>;
  getFileLines(
    file: string,
    startLine: number,
    endLine: number,
  ): Promise<string[]>;
}

async function enrichIssue(
  issue: ReviewIssue,
  gitService: EnrichGitService,
  onEvent: (event: EnrichProgressEvent) => void,
): Promise<ReviewIssue> {
  const enrichment: EnrichmentData = {
    blame: null,
    context: null,
    enrichedAt: new Date().toISOString(),
  };

  if (issue.line_start !== null && issue.line_start !== undefined) {
    onEvent({
      type: "enrich_progress",
      issueId: issue.id,
      enrichmentType: "blame",
      status: "started",
      timestamp: new Date().toISOString(),
    });

    const blame = await gitService.getBlame(issue.file, issue.line_start);
    enrichment.blame = blame;

    onEvent({
      type: "enrich_progress",
      issueId: issue.id,
      enrichmentType: "blame",
      status: blame ? "complete" : "failed",
      timestamp: new Date().toISOString(),
    });
  }

  if (issue.line_start !== null && issue.line_start !== undefined) {
    onEvent({
      type: "enrich_progress",
      issueId: issue.id,
      enrichmentType: "context",
      status: "started",
      timestamp: new Date().toISOString(),
    });

    const startLine = Math.max(1, issue.line_start - CONTEXT_LINES);
    const endLine = (issue.line_end ?? issue.line_start) + CONTEXT_LINES;
    const lines = await gitService.getFileLines(issue.file, startLine, endLine);

    const targetLineIndex = issue.line_start - startLine;
    enrichment.context = {
      beforeLines: lines.slice(0, targetLineIndex),
      afterLines: lines.slice(targetLineIndex + 1),
      totalContext: lines.length,
    };

    onEvent({
      type: "enrich_progress",
      issueId: issue.id,
      enrichmentType: "context",
      status: enrichment.context.totalContext > 0 ? "complete" : "failed",
      timestamp: new Date().toISOString(),
    });
  }

  return { ...issue, enrichment };
}

export async function enrichIssues(
  issues: ReviewIssue[],
  gitService: EnrichGitService,
  onEvent: (event: EnrichProgressEvent) => void,
  signal?: AbortSignal,
): Promise<ReviewIssue[]> {
  if (signal?.aborted) return issues;
  const enrichPromises = issues.map((issue) =>
    enrichIssue(issue, gitService, onEvent),
  );
  const enriched = await Promise.allSettled(enrichPromises);

  return enriched.map((result, i) =>
    result.status === "fulfilled" ? result.value : issues[i]!,
  );
}
