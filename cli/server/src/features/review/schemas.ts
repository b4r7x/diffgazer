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

const MAX_LENSES = 10;

const csvToArray = (value: string | undefined): string[] | undefined => {
  if (value === undefined) return undefined;
  const items = value.split(",").map((item) => item.trim()).filter((item) => item.length > 0);
  return items.length > 0 ? items : undefined;
};

// Active-session lookup must use the same scope inputs as session creation so a
// scoped review created through the public API is discoverable by resume. Scope
// arrays arrive as comma-separated query params; absent params yield the empty
// scope key, matching mode-only sessions.
export const ActiveSessionQuerySchema = z.object({
  mode: ReviewModeSchema.optional(),
  profile: ProfileIdSchema.optional(),
  lenses: z
    .string()
    .optional()
    .transform(csvToArray)
    .pipe(z.array(LensIdSchema).max(MAX_LENSES).optional()),
  files: z
    .string()
    .optional()
    .transform(csvToArray)
    .pipe(z.array(z.string().max(500).regex(/^[^\0]+$/)).max(200).optional()),
});

export const CreateReviewBodySchema = z.object({
  mode: ReviewModeSchema.optional(),
  profile: ProfileIdSchema.optional(),
  lenses: z.array(LensIdSchema)
    .transform((arr) => [...new Set(arr)])
    .pipe(z.array(LensIdSchema).max(MAX_LENSES))
    .transform((arr) => (arr.length === 0 ? undefined : arr))
    .optional(),
  files: z.array(z.string().max(500).regex(/^[^\0]+$/)).max(200).optional(),
}).refine(
  (data) => data.mode !== "files" || (Array.isArray(data.files) && data.files.length > 0),
  { message: "files[] must be non-empty when mode is 'files'", path: ["files"] },
);

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
