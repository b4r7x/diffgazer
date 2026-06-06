import type { ReviewIssue } from "@diffgazer/core/schemas/review";
import type { ReactNode } from "react";

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
