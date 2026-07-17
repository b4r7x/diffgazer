export interface ContextInfo {
  trustedDir?: string;
  providerName?: string;
  providerMode?: string;
  lastRunId?: string;
  lastRunIssueCount?: number;
}

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
