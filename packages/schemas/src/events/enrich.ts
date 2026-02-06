import { z } from "zod";

export const EnrichProgressEventSchema = z.object({
  type: z.literal("enrich_progress"),
  issueId: z.string(),
  enrichmentType: z.enum(["blame", "context"]),
  status: z.enum(["started", "complete", "failed"]),
  timestamp: z.string(),
}).passthrough();

export type EnrichProgressEvent = z.infer<typeof EnrichProgressEventSchema>;

export const EnrichEventSchema = z.discriminatedUnion("type", [
  EnrichProgressEventSchema,
]);

export type EnrichEvent = z.infer<typeof EnrichEventSchema>;
