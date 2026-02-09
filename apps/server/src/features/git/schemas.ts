import { z } from "zod";
import { ReviewModeSchema } from "@diffgazer/schemas/review";

export const GitDiffQuerySchema = z.object({
  mode: ReviewModeSchema.optional(),
  path: z.string().optional(),
});
