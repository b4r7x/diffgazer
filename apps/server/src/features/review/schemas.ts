import { z } from "zod";
import {
  LensIdSchema,
  ProfileIdSchema,
  ReviewModeSchema,
} from "@stargazer/schemas/review";

export const ReviewIdParamSchema = z.object({
  id: z.string().uuid(),
});

export const DrilldownRequestSchema = z.object({
  issueId: z.string().min(1),
});

export const ContextRefreshSchema = z.object({
  force: z.boolean().optional(),
});

const MAX_CSV_ITEMS = 1000;

export const parseCsvParam = (
  value: string | undefined | null,
): string[] | undefined => {
  if (!value) return undefined;
  const items = value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, MAX_CSV_ITEMS);
  return items.length > 0 ? items : undefined;
};

export const CsvLensIdsSchema = z
  .string()
  .transform((val) => parseCsvParam(val))
  .pipe(z.array(LensIdSchema).optional())
  .optional();

export const ReviewStreamQuerySchema = z.object({
  mode: ReviewModeSchema.optional(),
  profile: ProfileIdSchema.optional(),
  lenses: CsvLensIdsSchema,
  files: z.string().optional(),
});

export const DrilldownResponseSchema = z.object({
  detailedAnalysis: z.string(),
  rootCause: z.string(),
  impact: z.string(),
  suggestedFix: z.string(),
  patch: z.string().nullable(),
  relatedIssues: z.array(z.string()),
  references: z.array(z.string()),
});

export type DrilldownResponse = z.infer<typeof DrilldownResponseSchema>;
