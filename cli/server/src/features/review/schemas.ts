import {
  DrilldownResultSchema,
  LensIdSchema,
  ProfileIdSchema,
  ReviewModeSchema,
} from "@diffgazer/core/schemas/review";
import { z } from "zod";

export const ReviewIdParamSchema = z.object({
  id: z.string().uuid(),
});

export const DrilldownRequestSchema = z.object({
  issueId: z.string().min(1),
});

export const ContextRefreshSchema = z.object({
  force: z.boolean().optional(),
});

const MAX_LENSES = 10;

export const ActiveSessionQuerySchema = z.object({
  mode: ReviewModeSchema.optional(),
});

export const CreateReviewBodySchema = z
  .object({
    mode: ReviewModeSchema.optional(),
    profile: ProfileIdSchema.optional(),
    lenses: z
      .array(LensIdSchema)
      .transform((arr) => [...new Set(arr)])
      .pipe(z.array(LensIdSchema).max(MAX_LENSES))
      .transform((arr) => (arr.length === 0 ? undefined : arr))
      .optional(),
    files: z
      .array(
        z
          .string()
          .max(500)
          .regex(/^[^\0]+$/),
      )
      .max(200)
      .optional(),
  })
  .refine((data) => data.mode !== "files" || (Array.isArray(data.files) && data.files.length > 0), {
    message: "files[] must be non-empty when mode is 'files'",
    path: ["files"],
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
