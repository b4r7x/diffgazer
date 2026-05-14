import { z } from "zod";

const ContextInfoSchema = z.object({
  trustedDir: z.string().optional(),
  providerName: z.string().optional(),
  providerMode: z.string().optional(),
  lastRunId: z.string().optional(),
  lastRunIssueCount: z.number().optional(),
});
export type ContextInfo = z.infer<typeof ContextInfoSchema>;
