import { formatDuration, formatRunId } from "../../format.js";
import { pluralize } from "../../strings.js";

export interface ContextInfo {
  trustedDir?: string;
  providerName?: string;
  providerModel?: string;
  lastRunId?: string;
  lastRunIssueCount?: number;
  lastRunDurationMs?: number;
}

interface HomeContextRow {
  label: string;
  value: string;
}

interface HomeContextRows {
  trust: HomeContextRow;
  provider: HomeContextRow;
  lastRun: HomeContextRow & {
    issueCount?: string;
    /** "4 issues · 2m 14s" - the run's outcome in one line, or undefined with no run. */
    meta?: string;
    /** Lets the surface pick the success treatment without re-parsing `meta`. */
    hasIssues: boolean;
  };
}

export interface HomeContextInit {
  provider: string | null | undefined;
  model: string | null | undefined;
  trustedRepoRoot: string | null | undefined;
}

export interface HomeContextReview {
  id?: string;
  issueCount?: number;
  durationMs?: number;
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
    lastRunDurationMs: mostRecentReview?.durationMs,
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
  const issueCount = context.lastRunIssueCount;
  const durationMs = context.lastRunDurationMs;

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
        lastRunId !== undefined && issueCount !== undefined ? `(${issueCount} issues)` : undefined,
      meta: buildLastRunMeta(lastRunId, issueCount, durationMs),
      hasIssues: issueCount !== undefined && issueCount > 0,
    },
  };
}

/**
 * The one line under the run id: what the run found and how long it took. A run
 * with no recorded duration keeps the counts alone; with no run there is no
 * line at all.
 */
function buildLastRunMeta(
  lastRunId: string | undefined,
  issueCount: number | undefined,
  durationMs: number | undefined,
): string | undefined {
  if (lastRunId === undefined || issueCount === undefined) return undefined;
  const outcome = issueCount === 0 ? "no issues" : pluralize(issueCount, "issue");
  return durationMs === undefined ? outcome : `${outcome} · ${formatDuration(durationMs)}`;
}
