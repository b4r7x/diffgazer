import { z } from "zod";
import { LensIdSchema, ProfileIdSchema, ReviewModeSchema } from "@stargazer/schemas/review";

export const ReviewIdParamSchema = z.object({
  id: z.string().uuid(),
});

export const DrilldownRequestSchema = z.object({
  issueId: z.string().min(1),
});

export const ContextRefreshSchema = z.object({
  force: z.boolean().optional(),
});

export const parseCsvParam = (value: string | undefined | null): string[] | undefined => {
  if (!value) return undefined;
  const items = value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return items.length > 0 ? items : undefined;
};

export const CsvLensIdsSchema = z.string().transform((val) => {
  const items = parseCsvParam(val);
  return items ? z.array(LensIdSchema).parse(items) : undefined;
}).optional();

export const ReviewStreamQuerySchema = z.object({
  mode: ReviewModeSchema.optional(),
  profile: ProfileIdSchema.optional(),
  lenses: CsvLensIdsSchema,
  files: z.string().optional(),
});
