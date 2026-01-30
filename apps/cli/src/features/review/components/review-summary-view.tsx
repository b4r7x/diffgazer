import type { ReactElement } from "react";
import { useInput } from "ink";
import type { TriageIssue } from "@repo/schemas/triage";
import type { LensStats } from "../../../components/ui/lens-stats-table.js";
import {
  AnalysisSummary,
  type IssuePreview,
  type SeverityCounts,
} from "../../../components/ui/analysis-summary.js";

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
  const severityCounts: SeverityCounts = {
    blocker: issues.filter((i) => i.severity === "blocker").length,
    high: issues.filter((i) => i.severity === "high").length,
    medium: issues.filter((i) => i.severity === "medium").length,
    low: issues.filter((i) => i.severity === "low").length,
    nit: issues.filter((i) => i.severity === "nit").length,
  };

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
