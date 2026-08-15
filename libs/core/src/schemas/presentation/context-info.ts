import { formatDuration, formatRunId } from "../../format.js";
import { pluralize } from "../../strings.js";
import type { ReviewMetadata } from "../review/storage.js";

/** Why the last-run row has no id: its request is still in flight, or it failed. */
export type LastRunRequestState = "loading" | "unavailable";

/** The last-run row's state. `none` claims a settled, provably empty history. */
export type LastRunStatus = LastRunRequestState | "none" | "ready";

export interface HomeContextInfo {
  trustedDir?: string;
  providerName?: string;
  providerModel?: string;
  lastRunId?: string;
  lastRunIssueCount?: number;
  lastRunDurationMs?: number;
  /**
   * Set while the reviews request has not answered. Without it an absent
   * `lastRunId` reads as "no runs yet", so a caller that knows its request is
   * still loading or has failed must say so instead of claiming an empty
   * history.
   */
  lastRunRequest?: LastRunRequestState;
}

interface HomeContextRow {
  label: string;
  value: string;
}

interface HomeContextRows {
  trust: HomeContextRow;
  provider: HomeContextRow;
  lastRun: HomeContextRow & {
    /** Lets the surface treat an unreadable run differently without parsing `value`. */
    status: LastRunStatus;
    issueCount?: string;
    /** "4 issues · 2m 14s" - the run's outcome in one line, or undefined with no run. */
    meta?: string;
    /** Lets the surface pick the success treatment without re-parsing `meta`. */
    hasIssues: boolean;
  };
}

interface HomeContextInit {
  provider: string | null | undefined;
  model: string | null | undefined;
  trustedRepoRoot: string | null | undefined;
}

type HomeContextReview = Pick<ReviewMetadata, "id" | "issueCount" | "durationMs">;

/**
 * Builds the home-screen context info from the init config, the most recent
 * review summary, and the derived trust state. The trusted directory is only
 * surfaced when read access is granted.
 */
export function buildHomeContextInfo(
  init: HomeContextInit,
  mostRecentReview: HomeContextReview | null | undefined,
  isTrusted: boolean,
  lastRunRequest?: LastRunRequestState,
): HomeContextInfo {
  return {
    providerName: init.provider ?? undefined,
    providerModel: init.model ?? undefined,
    lastRunId: mostRecentReview?.id,
    lastRunIssueCount: mostRecentReview?.issueCount,
    lastRunDurationMs: mostRecentReview?.durationMs,
    lastRunRequest,
    trustedDir: isTrusted ? (init.trustedRepoRoot ?? undefined) : undefined,
  };
}

/**
 * Maps the reviews request both home surfaces run to the last-run row's request
 * state; a settled request returns `undefined`, which is what lets the row claim
 * an empty history.
 */
export function resolveLastRunRequest(query: {
  isPending: boolean;
  isError: boolean;
}): LastRunRequestState | undefined {
  if (query.isError) return "unavailable";
  if (query.isPending) return "loading";
  return undefined;
}

export function buildHomeContextRows({
  context,
  isTrusted,
  projectPath,
}: {
  context: HomeContextInfo;
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
  const lastRunStatus = resolveLastRunStatus(context);

  return {
    trust: {
      label: isTrusted ? "Trusted" : "Not trusted",
      value: context.trustedDir ?? projectPath ?? "—",
    },
    provider: { label: "Provider", value: providerValue },
    lastRun: {
      label: "Last Run",
      status: lastRunStatus,
      value: buildLastRunValue(lastRunId, context.lastRunRequest),
      issueCount:
        lastRunId !== undefined && issueCount !== undefined
          ? `(${pluralize(issueCount, "issue")})`
          : undefined,
      meta: buildLastRunMeta(lastRunId, issueCount, durationMs),
      hasIssues: issueCount !== undefined && issueCount > 0,
    },
  };
}

function resolveLastRunStatus(context: HomeContextInfo): LastRunStatus {
  if (context.lastRunId !== undefined) return "ready";
  return context.lastRunRequest ?? "none";
}

/**
 * The run id when there is one, else why there is not. "None" is a claim about a
 * settled request, so an in-flight or failed one reports itself instead.
 */
function buildLastRunValue(
  lastRunId: string | undefined,
  request: LastRunRequestState | undefined,
): string {
  if (lastRunId !== undefined) return formatRunId(lastRunId);
  if (request === "loading") return "Loading...";
  if (request === "unavailable") return "Unavailable";
  return "None";
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
