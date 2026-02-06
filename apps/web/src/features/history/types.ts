export const HISTORY_FOCUS_ZONES = ["timeline", "runs", "insights", "search"] as const;
export type HistoryFocusZone = (typeof HISTORY_FOCUS_ZONES)[number];
