import type { HistoryRunSummary } from "@diffgazer/core/review";
import { SEVERITY_ORDER } from "@diffgazer/core/schemas/presentation";
import type { ReviewIssue } from "@diffgazer/core/schemas/review";
import type { HistoryFocusZone } from "../types";

export type MappedRun = HistoryRunSummary;

export const HISTORY_ZONE_ORDER: HistoryFocusZone[] = ["search", "timeline", "runs", "insights"];

export function nextHistoryZone(current: HistoryFocusZone): HistoryFocusZone {
  const idx = HISTORY_ZONE_ORDER.indexOf(current);
  const next = HISTORY_ZONE_ORDER[(idx + 1) % HISTORY_ZONE_ORDER.length];
  return next ?? current;
}

export function sortIssuesBySeverity(issues: readonly ReviewIssue[] | undefined): ReviewIssue[] {
  if (!issues || issues.length === 0) return [];
  return [...issues].sort(
    (a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity),
  );
}
