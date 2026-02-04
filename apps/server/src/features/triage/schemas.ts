import { z } from "zod";

export const TriageReviewIdParamSchema = z.object({
  id: z.string().uuid(),
});

export const DrilldownRequestSchema = z.object({
  issueId: z.string().min(1),
});

export type DrilldownRequest = z.infer<typeof DrilldownRequestSchema>;
