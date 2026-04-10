import { z } from "zod";
import { ReviewIssueSchema, TraceRefSchema } from "./issues.js";
import { LensIdSchema } from "./shared.js";

export {
  LENS_IDS, LensIdSchema, type LensId,
  PROFILE_IDS, ProfileIdSchema, type ProfileId,
  ReviewProfileSchema, type ReviewProfile,
} from "./shared.js";

export const SeverityRubricSchema = z.object({
  blocker: z.string(),
  high: z.string(),
  medium: z.string(),
  low: z.string(),
  nit: z.string(),
});
export type SeverityRubric = z.infer<typeof SeverityRubricSchema>;

export const LensSchema = z.object({
  id: LensIdSchema,
  name: z.string(),
  description: z.string(),
  systemPrompt: z.string(),
  severityRubric: SeverityRubricSchema,
});
export type Lens = z.infer<typeof LensSchema>;

export const DrilldownResultSchema = z.object({
  issueId: z.string(),
  issue: ReviewIssueSchema,
  detailedAnalysis: z.string(),
  rootCause: z.string(),
  impact: z.string(),
  suggestedFix: z.string(),
  patch: z.string().nullable(),
  relatedIssues: z.array(z.string()),
  references: z.array(z.string()),
  trace: z.array(TraceRefSchema).optional(),
});
export type DrilldownResult = z.infer<typeof DrilldownResultSchema>;
