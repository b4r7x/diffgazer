import { UuidSchema } from "@diffgazer/core/schemas/fields";
import {
  DrilldownResultSchema,
  LensIdSchema,
  ProfileIdSchema,
  ReviewModeSchema,
} from "@diffgazer/core/schemas/review";
import { z } from "zod";
import { isRepoRelativePath } from "../../shared/lib/paths.js";

export const ReviewIdParamSchema = z.object({
  id: UuidSchema,
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

// Shared with features/git/service.ts: reject absolute paths, drive letters,
// `..` segments, and NUL before values reach `git diff -- <pathspecs>`.
// Non-ASCII is allowed because decoded git paths (F-090/F-013) are unicode.
const RepoRelativePathSchema = z
  .string()
  .min(1)
  .max(500)
  .refine(isRepoRelativePath, { error: "files[] entries must be repo-relative paths" });

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
    files: z.array(RepoRelativePathSchema).max(200).optional(),
  })
  .refine((data) => data.mode !== "files" || (Array.isArray(data.files) && data.files.length > 0), {
    error: "files[] must be non-empty when mode is 'files'",
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
