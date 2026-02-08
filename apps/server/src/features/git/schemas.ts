import { z } from "zod";
import { ReviewModeSchema } from "@stargazer/schemas/review";

export const GitDiffQuerySchema = z.object({
  mode: ReviewModeSchema.optional(),
  path: z.string().optional(),
});
