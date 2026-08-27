import type { HistoryFocusZone } from "../types";

const HISTORY_ZONE_ORDER: HistoryFocusZone[] = ["search", "timeline", "runs", "insights"];

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

const HISTORY_ZONE_EDGES: Record<
  HistoryFocusZone,
  { left: HistoryFocusZone | null; right: HistoryFocusZone | null }
> = {
  search: { left: null, right: null },
  timeline: { left: null, right: "runs" },
  runs: { left: "timeline", right: "insights" },
  insights: { left: "runs", right: null },
};

export function adjacentHistoryZone(
  current: HistoryFocusZone,
  direction: 1 | -1,
  availableZones: HistoryFocusZone[] = HISTORY_ZONE_ORDER,
): HistoryFocusZone | null {
  const edges = HISTORY_ZONE_EDGES[current];
  const target = direction === 1 ? edges.right : edges.left;
  if (target === null || !availableZones.includes(target)) return null;
  return target;
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
