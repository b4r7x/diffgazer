import { z } from "zod";

const ContextInfoSchema = z.object({
  trustedDir: z.string().optional(),
  providerName: z.string().optional(),
  providerMode: z.string().optional(),
  lastRunId: z.string().optional(),
  lastRunIssueCount: z.number().optional(),
});
export type ContextInfo = z.infer<typeof ContextInfoSchema>;

export interface HomeContextInit {
  provider: string | null | undefined;
  model: string | null | undefined;
  trustedRepoRoot: string | null | undefined;
}

export interface HomeContextReview {
  id?: string;
  issueCount?: number;
}

/**
 * Builds the home-screen ContextInfo from the init config, the most recent
 * review summary, and the derived trust state. The trusted directory is only
 * surfaced when read access is granted.
 */
export function buildHomeContextInfo(
  init: HomeContextInit,
  mostRecentReview: HomeContextReview | null | undefined,
  isTrusted: boolean,
): ContextInfo {
  return {
    providerName: init.provider ?? undefined,
    providerMode: init.model ?? undefined,
    lastRunId: mostRecentReview?.id,
    lastRunIssueCount: mostRecentReview?.issueCount,
    trustedDir: isTrusted ? (init.trustedRepoRoot ?? undefined) : undefined,
  };
}
