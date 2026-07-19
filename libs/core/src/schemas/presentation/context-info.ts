import { formatRunId } from "../../format.js";

export interface ContextInfo {
  trustedDir?: string;
  providerName?: string;
  providerModel?: string;
  lastRunId?: string;
  lastRunIssueCount?: number;
}

interface HomeContextRow {
  label: string;
  value: string;
}

interface HomeContextRows {
  trust: HomeContextRow;
  provider: HomeContextRow;
  lastRun: HomeContextRow & { issueCount?: string };
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
    providerModel: init.model ?? undefined,
    lastRunId: mostRecentReview?.id,
    lastRunIssueCount: mostRecentReview?.issueCount,
    trustedDir: isTrusted ? (init.trustedRepoRoot ?? undefined) : undefined,
  };
}

export function buildHomeContextRows({
  context,
  isTrusted,
  projectPath,
}: {
  context: ContextInfo;
  isTrusted: boolean;
  projectPath?: string;
}): HomeContextRows {
  const providerName = context.providerName;
  const providerModel = context.providerModel;
  let providerValue = "Not configured";
  if (providerName !== undefined) {
    providerValue =
      providerModel === undefined ? providerName : `${providerName} (${providerModel})`;
  }
  const lastRunId = context.lastRunId;

  return {
    trust: {
      label: isTrusted ? "Trusted" : "Not trusted",
      value: context.trustedDir ?? projectPath ?? "—",
    },
    provider: { label: "Provider", value: providerValue },
    lastRun: {
      label: "Last Run",
      value: lastRunId !== undefined ? formatRunId(lastRunId) : "None",
      issueCount:
        lastRunId !== undefined && context.lastRunIssueCount !== undefined
          ? `(${context.lastRunIssueCount} issues)`
          : undefined,
    },
  };
}
