import { z } from "zod";
import { ReviewSeveritySchema } from "../review/issues.js";

const AnalysisStatsSchema = z.object({
  runId: z.string(),
  totalIssues: z.number(),
  filesAnalyzed: z.number(),
  blockerCount: z.number(),
});
export type AnalysisStats = z.infer<typeof AnalysisStatsSchema>;

const IssuePreviewSchema = z.object({
  id: z.string(),
  title: z.string(),
  file: z.string(),
  line: z.number(),
  category: z.string(),
  severity: ReviewSeveritySchema,
});
export type IssuePreview = z.infer<typeof IssuePreviewSchema>;
