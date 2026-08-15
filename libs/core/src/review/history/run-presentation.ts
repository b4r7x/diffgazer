import { formatRunId, getTimestamp, type RunIdLookup } from "../../format.js";
import { DETACHED_HEAD_BRANCH } from "../../schemas/git.js";
import type { ReviewMetadata, ReviewSeverity, SeverityCounts } from "../../schemas/review/index.js";
import { pluralize } from "../../strings.js";

export interface SeverityPart {
  severity: ReviewSeverity;
  count: number;
}

export interface RunSummaryParts {
  passed: boolean;
  partial: boolean;
  failedLensCount: number;
  parts: SeverityPart[];
  issueCount: number;
}

export function getRunBranchLabel(metadata: ReviewMetadata): string {
  if (metadata.mode === "staged") return "Staged";
  if (metadata.branch === DETACHED_HEAD_BRANCH) return "Detached HEAD";
  return metadata.branch ?? "Unknown branch";
}

export function getRunSummaryParts(metadata: ReviewMetadata): RunSummaryParts {
  const { blockerCount, highCount, mediumCount, lowCount, nitCount, issueCount } = metadata;
  const failedLensCount = metadata.failedLensCount ?? 0;
  const partial = failedLensCount > 0;
  const terminalOutcome = metadata.terminalOutcome ?? "completed";

  const parts: SeverityPart[] = [];
  if (blockerCount > 0) parts.push({ severity: "blocker", count: blockerCount });
  if (highCount > 0) parts.push({ severity: "high", count: highCount });
  if (mediumCount > 0) parts.push({ severity: "medium", count: mediumCount });
  if (lowCount > 0) parts.push({ severity: "low", count: lowCount });
  if (nitCount > 0) parts.push({ severity: "nit", count: nitCount });

  return {
    passed: terminalOutcome === "completed" && issueCount === 0 && !partial,
    partial,
    failedLensCount,
    parts,
    issueCount,
  };
}

export function getRunSummaryText(metadata: ReviewMetadata): string {
  const summary = getRunSummaryParts(metadata);
  if (metadata.terminalOutcome && metadata.terminalOutcome !== "completed") {
    return `Review ended with outcome ${metadata.terminalOutcome}.`;
  }
  if (summary.partial) {
    const findings =
      summary.issueCount === 0
        ? "no issues found"
        : `${pluralize(summary.issueCount, "issue")} found`;
    return `Partial analysis: ${pluralize(summary.failedLensCount, "lens", "lenses")} failed; ${findings}.`;
  }
  if (summary.passed) return "Passed with no issues.";
  if (summary.parts.length === 0) {
    return `Found ${pluralize(summary.issueCount, "issue")}.`;
  }
  return summary.parts.map((p) => `${p.count} ${p.severity}`).join(", ");
}

export interface HistoryRunSummary {
  id: string;
  displayId: string;
  branch: string;
  timestamp: string;
  summary: string;
}

export function resolveRunDisplayId(metadata: ReviewMetadata, runIdLookup?: RunIdLookup): string {
  return runIdLookup?.get(metadata.id) ?? formatRunId(metadata.id);
}

export function buildHistoryRunSummary(
  metadata: ReviewMetadata,
  runIdLookup?: RunIdLookup,
): HistoryRunSummary {
  return {
    id: metadata.id,
    displayId: resolveRunDisplayId(metadata, runIdLookup),
    branch: getRunBranchLabel(metadata),
    timestamp: getTimestamp(metadata.createdAt),
    summary: getRunSummaryText(metadata),
  };
}

export function metadataToSeverityCounts(metadata: ReviewMetadata | null): SeverityCounts | null {
  if (!metadata) return null;
  return {
    blocker: metadata.blockerCount,
    high: metadata.highCount,
    medium: metadata.mediumCount,
    low: metadata.lowCount,
    nit: metadata.nitCount,
  };
}
