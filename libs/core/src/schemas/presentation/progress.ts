import type { LIFECYCLE_STATUSES } from "../events/statuses.js";

export type ProgressStatus = "completed" | "active" | "pending" | "error";

export interface ProgressSubstepData {
  id: string;
  tag: string;
  label: string;
  status: (typeof LIFECYCLE_STATUSES)[number];
  detail?: string;
}

export interface ProgressStepData {
  id: string;
  label: string;
  status: ProgressStatus;
}

export interface ProgressStepWithSubstepsData extends ProgressStepData {
  substeps?: ProgressSubstepData[];
}

export interface ReviewProgressMetrics {
  filesProcessed: number;
  filesTotal: number;
  issuesFound: number;
}

type ReviewMetricId = "files-in-prompt" | "issues-found" | "elapsed";

/** Emphasis a surface gives a metric, so web and TUI highlight the same rows. */
export type ReviewMetricTone = "default" | "info" | "warning";

interface ReviewMetricRow<TElapsed> {
  id: ReviewMetricId;
  label: string;
  value: string | number | TElapsed;
  tone: ReviewMetricTone;
}

export function buildReviewMetricsRows<TElapsed>(
  metrics: ReviewProgressMetrics,
  elapsed: TElapsed,
): ReviewMetricRow<TElapsed>[] {
  const filesTotal = metrics.filesTotal > 0 ? String(metrics.filesTotal) : "...";

  return [
    {
      id: "files-in-prompt",
      label: "Files in Prompt",
      value: `${metrics.filesProcessed}/${filesTotal}`,
      tone: "default",
    },
    {
      id: "issues-found",
      label: "Issues Found",
      value: metrics.issuesFound,
      tone: metrics.issuesFound > 0 ? "warning" : "default",
    },
    { id: "elapsed", label: "Elapsed", value: elapsed, tone: "info" },
  ];
}
