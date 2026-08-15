import { ReviewModeSchema } from "@diffgazer/core/schemas/review";
import { z } from "zod";

const GitDiffModeSchema = ReviewModeSchema.exclude(["files"]);

export const GitDiffQuerySchema = z.object({
  mode: GitDiffModeSchema.optional(),
});
