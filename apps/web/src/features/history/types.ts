import type { ReactNode } from "react";

export type HistoryFocusZone =
  | "chrome"
  | "warnings"
  | "list-retry"
  | "timeline"
  | "runs"
  | "load-more"
  | "insights"
  | "retry"
  | "search";

export interface Run {
  id: string;
  displayId: string;
  branch: string;
  timestamp: string;
  summary: ReactNode;
}
