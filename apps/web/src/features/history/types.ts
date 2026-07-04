import type { ReactNode } from "react";

export type HistoryFocusZone = "timeline" | "runs" | "insights" | "search";

export interface Run {
  id: string;
  displayId: string;
  branch: string;
  timestamp: string;
  summary: ReactNode;
}
