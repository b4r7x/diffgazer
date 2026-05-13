import { z } from "zod";
import {
  LensIdSchema,
  ProfileIdSchema,
  ReviewModeSchema,
  DrilldownResultSchema,
} from "@diffgazer/core/schemas/review";

export const ReviewIdParamSchema = z.object({
  id: z.string().uuid(),
});

export const DrilldownRequestSchema = z.object({
  issueId: z.string().min(1),
});

export const ContextRefreshSchema = z.object({
  force: z.boolean().optional(),
});

export const ActiveSessionQuerySchema = z.object({
  mode: ReviewModeSchema.optional(),
});

export const CreateReviewBodySchema = z.object({
  mode: ReviewModeSchema.optional(),
  profile: ProfileIdSchema.optional(),
  lenses: z.array(LensIdSchema).optional(),
  files: z.array(z.string()).optional(),
});

/**
 * AI response shape for drilldown — derived from the shared DrilldownResultSchema
 * by picking only the fields the AI generates (excludes issueId, issue, trace).
 */
export const DrilldownResponseSchema = DrilldownResultSchema.pick({
  detailedAnalysis: true,
  rootCause: true,
  impact: true,
  suggestedFix: true,
  patch: true,
  relatedIssues: true,
  references: true,
});

export type DrilldownAIResponse = z.infer<typeof DrilldownResponseSchema>;
