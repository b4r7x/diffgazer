import type { ReviewSeverity } from "@diffgazer/core/schemas/review";

export interface ReviewItem {
  id: string;
  displayId: string;
  branch: string;
  timestamp: string;
  summary: string;
  date: string;
  issueCount: number;
  severities: Array<{ severity: ReviewSeverity; count: number }>;
  duration: number;
  mode: string;
}

export interface DateGroup {
  dateKey: string;
  label: string;
  reviews: ReviewItem[];
}
