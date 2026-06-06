import { ReviewModeSchema } from "@diffgazer/core/schemas/review";
import { z } from "zod";

export const GitDiffQuerySchema = z.object({
  mode: ReviewModeSchema.optional(),
  path: z.string().optional(),
});
