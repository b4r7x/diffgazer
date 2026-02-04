import { z } from "zod";

export const PRReviewRequestSchema = z.object({
  diff: z.string().min(1, "diff is required"),
  lenses: z.array(z.string()).optional(),
  profile: z.string().optional(),
  baseRef: z.string().optional(),
  headRef: z.string().optional(),
});

export type PRReviewRequest = z.infer<typeof PRReviewRequestSchema>;
