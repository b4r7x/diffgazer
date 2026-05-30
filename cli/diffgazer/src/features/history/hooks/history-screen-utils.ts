import {
  getRunBranchLabel,
  getRunDisplayId,
  getRunSummaryText,
} from "@diffgazer/core/review";
import { getTimestamp } from "@diffgazer/core/format";
import type { ReviewIssue, ReviewMetadata } from "@diffgazer/core/schemas/review";
import { SEVERITY_ORDER, type SeverityCounts } from "@diffgazer/core/schemas/presentation";
import type { HistoryFocusZone } from "../types";

export interface MappedRun {
  id: string;
  displayId: string;
  branch: string;
  timestamp: string;
  summary: string;
}

export const HISTORY_ZONE_ORDER: HistoryFocusZone[] = [
  "search",
  "timeline",
  "runs",
  "insights",
];

export function nextHistoryZone(current: HistoryFocusZone): HistoryFocusZone {
  const idx = HISTORY_ZONE_ORDER.indexOf(current);
  return HISTORY_ZONE_ORDER[(idx + 1) % HISTORY_ZONE_ORDER.length]!;
}

export function mapHistoryRun(metadata: ReviewMetadata): MappedRun {
  return {
    id: metadata.id,
    displayId: getRunDisplayId(metadata),
    branch: getRunBranchLabel(metadata),
    timestamp: getTimestamp(metadata.createdAt),
    summary: getRunSummaryText(metadata),
  };
}

export function buildHistorySeverityCounts(run: ReviewMetadata | null): SeverityCounts | null {
  if (!run) return null;
  return {
    blocker: run.blockerCount,
    high: run.highCount,
    medium: run.mediumCount,
    low: run.lowCount,
    nit: run.nitCount,
  };
}

export function sortIssuesBySeverity(issues: readonly ReviewIssue[] | undefined): ReviewIssue[] {
  if (!issues || issues.length === 0) return [];
  return [...issues].sort(
    (a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity),
  );
}
