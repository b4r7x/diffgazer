import type { HistoryRunSummary } from "@diffgazer/core/review";
import type { HistoryFocusZone } from "../types";

export type MappedRun = HistoryRunSummary;

export const HISTORY_ZONE_ORDER: HistoryFocusZone[] = ["search", "timeline", "runs", "insights"];

export function nextHistoryZone(current: HistoryFocusZone): HistoryFocusZone {
  const idx = HISTORY_ZONE_ORDER.indexOf(current);
  const next = HISTORY_ZONE_ORDER[(idx + 1) % HISTORY_ZONE_ORDER.length];
  return next ?? current;
}
