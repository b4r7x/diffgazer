import type { ReviewSeverity } from "../review/enums.js";

export interface AnalysisStats {
  runId: string | null;
  totalIssues: number;
  filesWithIssues: number;
  blockerCount: number;
}

export interface IssuePreview {
  id: string;
  title: string;
  file: string;
  line?: number | null;
  category: string;
  severity: ReviewSeverity;
}
