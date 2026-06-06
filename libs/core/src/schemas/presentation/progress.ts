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
  progress: z.number().min(0).max(100).optional(),
});
export type ProgressSubstepData = z.infer<typeof ProgressSubstepDataSchema>;

const ProgressStepDataSchema = z.object({
  id: z.string(),
  label: z.string(),
  status: ProgressStatusSchema,
  substeps: z.array(ProgressSubstepDataSchema).optional(),
});
export type ProgressStepData = z.infer<typeof ProgressStepDataSchema>;

const ReviewProgressMetricsSchema = z.object({
  filesProcessed: z.number().nonnegative(),
  filesTotal: z.number().nonnegative(),
  issuesFound: z.number().nonnegative(),
});
export type ReviewProgressMetrics = z.infer<typeof ReviewProgressMetricsSchema>;
