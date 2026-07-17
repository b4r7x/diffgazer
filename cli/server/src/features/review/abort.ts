import { StepIdSchema } from "@diffgazer/core/schemas/events";
import { ReviewErrorSchema } from "@diffgazer/core/schemas/review";
import { z } from "zod";

export const ReviewAbortSchema = ReviewErrorSchema.extend({
  kind: z.literal("review_abort"),
  step: StepIdSchema.optional(),
});
export type ReviewAbort = z.infer<typeof ReviewAbortSchema>;

export function reviewAbort(
  message: string,
  code: ReviewAbort["code"],
  step?: ReviewAbort["step"],
): ReviewAbort {
  return { kind: "review_abort", message, code, step };
}

export function isReviewAbort(error: unknown): error is ReviewAbort {
  return ReviewAbortSchema.safeParse(error).success;
}
