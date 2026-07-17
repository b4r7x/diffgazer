import { z } from "zod";
import { ReviewSeveritySchema } from "../review/issues.js";

const AnalysisStatsSchema = z.object({
  runId: z.string().nullable(),
  totalIssues: z.number(),
  filesWithIssues: z.number(),
  blockerCount: z.number(),
});
export type AnalysisStats = z.infer<typeof AnalysisStatsSchema>;

const IssuePreviewSchema = z.object({
  id: z.string(),
  title: z.string(),
  file: z.string(),
  line: z.number().nullable().optional(),
  category: z.string(),
  severity: ReviewSeveritySchema,
});
export type IssuePreview = z.infer<typeof IssuePreviewSchema>;
