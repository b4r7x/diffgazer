import { z } from "zod";
import {
  createDomainErrorCodes,
  createDomainErrorSchema,
  type SharedErrorCode,
} from "./errors.js";
import { TriageIssueSchema, TriageSeveritySchema, TraceRefSchema } from "./triage.js";

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

export const SeverityFilterSchema = z.object({
  minSeverity: TriageSeveritySchema,
});
export type SeverityFilter = z.infer<typeof SeverityFilterSchema>;

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
  issue: TriageIssueSchema,
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

export const LENS_SPECIFIC_CODES = ["NO_DIFF", "AI_ERROR", "LENS_NOT_FOUND", "PROFILE_NOT_FOUND"] as const;
export type LensSpecificCode = (typeof LENS_SPECIFIC_CODES)[number];

export const LENS_ERROR_CODES = createDomainErrorCodes(LENS_SPECIFIC_CODES);
export const LensErrorCodeSchema = z.enum(LENS_ERROR_CODES as unknown as [string, ...string[]]);
export type LensErrorCode = SharedErrorCode | LensSpecificCode;

export const LensErrorSchema = createDomainErrorSchema(LENS_SPECIFIC_CODES);
export type LensError = z.infer<typeof LensErrorSchema>;
