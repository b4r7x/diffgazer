export interface ReviewItem {
  id: string;
  displayId: string;
  branch: string;
  timestamp: string;
  summary: string;
  date: string;
  issueCount: number;
  severities: Array<{ severity: string; count: number }>;
  duration: number;
  mode: string;
}

export interface DateGroup {
  dateKey: string;
  label: string;
  reviews: ReviewItem[];
}
