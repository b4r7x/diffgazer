import type { HistoryRunSummary } from "@diffgazer/core/review";
import type { HistoryFocusZone } from "../types";

export type MappedRun = HistoryRunSummary;

export const HISTORY_ZONE_ORDER: HistoryFocusZone[] = ["search", "timeline", "runs", "insights"];

export function getAvailableHistoryZones({
  hasRuns,
  hasSelectedRun,
}: {
  hasRuns: boolean;
  hasSelectedRun: boolean;
}): HistoryFocusZone[] {
  if (!hasRuns) return ["search", "timeline"];
  if (!hasSelectedRun) return ["search", "timeline", "runs"];
  return HISTORY_ZONE_ORDER;
}

export function nextHistoryZone(
  current: HistoryFocusZone,
  availableZones: HistoryFocusZone[] = HISTORY_ZONE_ORDER,
): HistoryFocusZone {
  const idx = availableZones.indexOf(current);
  if (idx === -1) return availableZones[0] ?? current;
  const next = availableZones[(idx + 1) % availableZones.length];
  return next ?? current;
}
