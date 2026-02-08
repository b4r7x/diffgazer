import { z } from "zod";
import { ReviewIssueSchema, TraceRefSchema, SeverityFilterSchema } from "./issues.js";
export { SeverityFilterSchema, type SeverityFilter } from "./issues.js";

export const LENS_IDS = [
  "correctness",
  "security",
  "performance",
  "simplicity",
  "tests",
] as const;

export const LensIdSchema = z.enum(LENS_IDS);
export type LensId = z.infer<typeof LensIdSchema>;

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

export const PROFILE_IDS = ["quick", "strict", "perf", "security"] as const;
export const ProfileIdSchema = z.enum(PROFILE_IDS);
export type ProfileId = z.infer<typeof ProfileIdSchema>;

export const ReviewProfileSchema = z.object({
  id: ProfileIdSchema,
  name: z.string(),
  description: z.string(),
  lenses: z.array(LensIdSchema),
  filter: SeverityFilterSchema.optional(),
});
export type ReviewProfile = z.infer<typeof ReviewProfileSchema>;

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
