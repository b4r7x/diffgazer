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

/** What a run that found nothing has to show in the insights pane instead of five zero bars. */
export interface HistoryCleanRun {
  statement: string;
  /** The shared evidence line both surfaces' clean panes speak. */
  factLine: string;
}
