import { z } from "zod";
import { LIFECYCLE_STATUSES } from "../events/statuses.js";

const PROGRESS_STATUSES = ["completed", "active", "pending"] as const;
const ProgressStatusSchema = z.enum(PROGRESS_STATUSES);
export type ProgressStatus = z.infer<typeof ProgressStatusSchema>;

const ProgressSubstepDataSchema = z.object({
  id: z.string(),
  tag: z.string(),
  label: z.string(),
  status: z.enum(LIFECYCLE_STATUSES),
  detail: z.string().optional(),
});
export type ProgressSubstepData = z.infer<typeof ProgressSubstepDataSchema>;

const ProgressStepDataSchema = z.object({
  id: z.string(),
  label: z.string(),
  status: ProgressStatusSchema,
});
export type ProgressStepData = z.infer<typeof ProgressStepDataSchema>;

const ProgressStepWithSubstepsDataSchema = ProgressStepDataSchema.extend({
  substeps: z.array(ProgressSubstepDataSchema).optional(),
});
export type ProgressStepWithSubstepsData = z.infer<typeof ProgressStepWithSubstepsDataSchema>;

const ReviewProgressMetricsSchema = z.object({
  filesProcessed: z.number().nonnegative(),
  filesTotal: z.number().nonnegative(),
  issuesFound: z.number().nonnegative(),
});
export type ReviewProgressMetrics = z.infer<typeof ReviewProgressMetricsSchema>;

export type ReviewMetricId = "files-in-prompt" | "issues-found" | "elapsed";

export interface ReviewMetricRow<TElapsed> {
  id: ReviewMetricId;
  label: string;
  value: string | number | TElapsed;
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
      value: `${String(metrics.filesProcessed)}/${filesTotal}`,
    },
    { id: "issues-found", label: "Issues Found", value: metrics.issuesFound },
    { id: "elapsed", label: "Elapsed", value: elapsed },
  ];
}
