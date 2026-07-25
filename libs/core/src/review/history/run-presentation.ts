import { formatRunId, getTimestamp } from "../../format.js";
import type { SeverityCounts } from "../../schemas/presentation/index.js";
import type { ReviewMetadata, ReviewSeverity } from "../../schemas/review/index.js";
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
  return metadata.mode === "staged" ? "Staged" : (metadata.branch ?? "Main");
}

export function getRunSummaryParts(metadata: ReviewMetadata): RunSummaryParts {
  const { blockerCount, highCount, mediumCount, lowCount, nitCount, issueCount } = metadata;
  const failedLensCount = metadata.failedLensCount ?? 0;
  const partial = failedLensCount > 0;

  const parts: SeverityPart[] = [];
  if (blockerCount > 0) parts.push({ severity: "blocker", count: blockerCount });
  if (highCount > 0) parts.push({ severity: "high", count: highCount });
  if (mediumCount > 0) parts.push({ severity: "medium", count: mediumCount });
  if (lowCount > 0) parts.push({ severity: "low", count: lowCount });
  if (nitCount > 0) parts.push({ severity: "nit", count: nitCount });

  return {
    passed: issueCount === 0 && !partial,
    partial,
    failedLensCount,
    parts,
    issueCount,
  };
}

export function getRunSummaryText(metadata: ReviewMetadata): string {
  const summary = getRunSummaryParts(metadata);
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

export function buildHistoryRunSummary(
  metadata: ReviewMetadata,
  peerIds: readonly string[] = [],
): HistoryRunSummary {
  return {
    id: metadata.id,
    displayId: formatRunId(metadata.id, peerIds),
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
