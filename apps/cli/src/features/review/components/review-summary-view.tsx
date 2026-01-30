import type { ReactElement } from "react";
import { useInput } from "ink";
import type { TriageIssue } from "@repo/schemas/triage";
import type { LensStats } from "../../../components/ui/lens-stats-table.js";
import {
  AnalysisSummary,
  type IssuePreview,
} from "../../../components/ui/analysis-summary.js";
import { calculateSeverityCounts } from "../../../lib/severity-counts.js";

export interface ReviewSummaryViewProps {
  issues: TriageIssue[];
  runId: string;
  filesAnalyzed: number;
  lensStats: LensStats[];
  onEnterReview: () => void;
  onBack: () => void;
}

export function ReviewSummaryView({
  issues,
  runId,
  filesAnalyzed,
  lensStats,
  onEnterReview,
  onBack,
}: ReviewSummaryViewProps): ReactElement {
  const severityCounts = calculateSeverityCounts(issues);

  const topIssues: IssuePreview[] = issues.slice(0, 3).map((issue) => ({
    id: issue.id,
    title: issue.title,
    file: issue.file,
    line: issue.line_start ?? 0,
    category: issue.category,
    severity: issue.severity,
  }));

  useInput((input, key) => {
    if (input === "e" || key.return) {
      onEnterReview();
    } else if (input === "b" || key.escape) {
      onBack();
    }
    // "x" is a no-op for now
  });

  return (
    <AnalysisSummary
      stats={{
        runId,
        totalIssues: issues.length,
        filesAnalyzed,
        criticalCount: severityCounts.blocker,
      }}
      severityCounts={severityCounts}
      lensStats={lensStats}
      topIssues={topIssues}
    />
  );
}
