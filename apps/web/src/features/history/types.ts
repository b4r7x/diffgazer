import type { ReactNode } from "react";
import type { ReviewIssue } from "@diffgazer/schemas/review";

export type HistoryFocusZone = "timeline" | "runs" | "insights" | "search";

export interface Run {
  id: string;
  displayId: string;
  branch: string;
  provider: string;
  timestamp: string;
  summary: ReactNode;
  issues: ReviewIssue[];
}
