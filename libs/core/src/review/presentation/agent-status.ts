import { formatDuration } from "../../format.js";
import {
  AGENT_METADATA,
  type AgentState,
  type AgentStatus,
  LENS_TO_AGENT,
  type LensStat,
} from "../../schemas/events/index.js";
import {
  type LensId,
  ReviewErrorCode,
  terminalOutcomeKeepsFindings,
} from "../../schemas/review/index.js";
import { pluralize } from "../../strings.js";
import type { FailedTerminalOutcome } from "../screen-state.js";
import type { ReviewEvent } from "../state.js";

export type AgentStatusBadgeVariant = "neutral" | "info" | "success" | "error";

export const AGENT_STATUS_META = {
  queued: { label: "WAIT", variant: "neutral" },
  running: { label: "RUN", variant: "info" },
  complete: { label: "DONE", variant: "success" },
  error: { label: "FAIL", variant: "error" },
} as const satisfies Record<
  AgentStatus,
  {
    label: string;
    variant: AgentStatusBadgeVariant;
  }
>;

export function getAgentStatusMeta(status: AgentStatus): {
  label: string;
  variant: AgentStatusBadgeVariant;
} {
  return AGENT_STATUS_META[status];
}

/**
 * Liveness of the event stream behind a running review, derived from the time
 * since the last event. Both the log's tail row and the progress panel read it,
 * so "is it alive?" is answered the same way in both places.
 */
export type LogStreamState = "flowing" | "quiet" | "stalled";

/**
 * True for events that restate what the agent board already shows. `agent_progress`
 * arrives every ~2s per agent and carries no state transition, so the log keeps
 * only things that happened and the tail row carries what is happening now.
 */
export function isAgentHeartbeatEvent(event: ReviewEvent): boolean {
  return event.type === "agent_progress";
}

export interface PartialFailureWarning {
  hasPartialFailure: boolean;
  message: string;
}

/**
 * Derives the post-review partial-failure warning shown when some agents failed
 * but the run did not error out. Suppressed while an error is surfaced so the
 * error takes precedence.
 */
export function getPartialFailureWarning(
  agents: readonly AgentState[],
  error: string | null,
  lensStats?: readonly LensStat[],
): PartialFailureWarning {
  const failedAgents = agents.filter((agent) => agent.status === "error");
  const hasPartialFailure = failedAgents.length > 0 && !error;
  if (!hasPartialFailure) return { hasPartialFailure: false, message: "" };

  const failedAgentNames = failedAgents.map((agent) => agent.meta.name).join(", ");
  const allFailedLensesWereRateLimited = failedAgents.every((agent) =>
    lensStats?.some(
      (stat) =>
        stat.lensId === agent.meta.lens &&
        stat.status === "failed" &&
        stat.errorCode === "RATE_LIMITED",
    ),
  );
  const failureReason = allFailedLensesWereRateLimited ? " (rate limited)" : "";
  return {
    hasPartialFailure: true,
    message: `${pluralize(failedAgents.length, "agent")} failed${failureReason}: ${failedAgentNames}. Results may be incomplete.`,
  };
}

/**
 * Names the lenses a saved or live run never heard back from. The results screen
 * and the live progress view both call it, so an incomplete run reads the same
 * wherever it is opened instead of looking complete once it is reloaded from
 * history.
 *
 * `totalLensCount` defaults to the number of lenses the run reported on, which
 * is what a caller holding only `lensStats` can know.
 */
export function buildLensFailureNotice(
  lensStats: readonly LensStat[] | undefined,
  totalLensCount: number = lensStats?.length ?? 0,
): string {
  const failed = (lensStats ?? []).filter((stat) => stat.status === "failed");
  if (failed.length === 0) return "";

  const rateLimited = failed.every((stat) => stat.errorCode === "RATE_LIMITED");
  const reason = rateLimited ? " (rate limited)" : "";
  // A failure implies at least one reported lens, so the total is never zero.
  const scope = `${failed.length} of ${totalLensCount} lenses failed`;

  return `Partial run — ${scope}${reason}. ${buildMissingLensIssuesNotice(lensStats)}`;
}

/**
 * Whether a completed run left failed lenses behind. The headline and the
 * summary panel's tone both read it, so "Partially Complete" and the frame's
 * colour can never drift apart.
 */
export function hasFailedLenses(lensStats: readonly LensStat[] | undefined): boolean {
  return (lensStats ?? []).some((stat) => stat.status === "failed");
}

/**
 * The summary headline for a run that reached its results: "Review Complete"
 * only when every tracked lens reported. A run that finished with failed
 * lenses must not headline as a pass — the partial coverage IS the headline.
 */
export function buildCompletionHeadline(lensStats: readonly LensStat[] | undefined): string {
  return hasFailedLenses(lensStats) ? "Review Partially Complete" : "Review Complete";
}

/**
 * The half of the notice that carries new information when the screen already
 * states how far the run got: which lenses produced nothing. Kept separate so a
 * surface that renders a coverage line never prints the same ratio twice.
 */
export function buildMissingLensIssuesNotice(lensStats: readonly LensStat[] | undefined): string {
  const failed = (lensStats ?? []).filter((stat) => stat.status === "failed");
  if (failed.length === 0) return "";

  const missing = formatList(failed.map((stat) => getLensAgentName(stat.lensId)));
  return `Issues from ${missing} are missing.`;
}

/**
 * What a run whose outcome discarded its findings owes the reader: the kept
 * total is zero while the per-lens counts beside it are not, and nothing else on
 * the screen reconciles the two. Empty for `budget-exhausted`, the one failed
 * outcome whose findings the server keeps.
 */
export function buildDroppedFindingsNotice(outcome: FailedTerminalOutcome | undefined): string {
  if (outcome === undefined || terminalOutcomeKeepsFindings(outcome)) return "";
  return "Findings are not kept for a run that ended this way; the counts below are what each lens reported before it ended.";
}

/**
 * How far a run got: the lenses that reported out of the lenses it tracked.
 * One shape, so the error screen, both summaries and the history row cannot
 * print different totals for the same run.
 */
interface LensCoverage {
  completed: number;
  total: number;
}

/** Whether the run got a report out of at least one lens before it ended. */
export function hasCompletedLens(lensStats: readonly LensStat[] | undefined): boolean {
  return (lensStats ?? []).some((stat) => stat.status === "success");
}

export function getLensCoverage(lensStats: readonly LensStat[] | undefined): LensCoverage {
  const stats = lensStats ?? [];
  return {
    completed: stats.filter((stat) => stat.status === "success").length,
    total: stats.length,
  };
}

/**
 * The one sentence a failed run uses to say how far it got, rendered by both
 * summaries and the history row. Coverage leads because it is what decides
 * whether the issue count means anything: "0 issues" from two of five lenses is
 * coverage that stopped, not a clean bill of health. The outcome title is not
 * part of it — every caller already shows the title in its own headline.
 */
export function buildTerminalCoverageLine(input: {
  coverage: LensCoverage;
  issueCount: number;
  durationMs?: number;
}): string {
  const { coverage, issueCount, durationMs } = input;
  const elapsed = durationMs === undefined ? "" : ` · ${formatDuration(durationMs)}`;
  const completed = `${coverage.completed} of ${pluralize(coverage.total, "lens", "lenses")} completed`;
  return `${completed} · ${pluralize(issueCount, "issue")}${elapsed}`;
}

/**
 * The error codes the server reports once the run is on disk: the whole
 * vocabulary of `terminalErrorCode`, which runs from `finalizeReview` after the
 * write commits (cli/server/src/features/review/pipeline.ts). Pair it with
 * {@link hasCompletedLens} — a run that ends before the save can report one of
 * these too, but only from an orchestration where no lens succeeded.
 */
export const PERSISTED_RUN_ERROR_CODES: readonly string[] = [
  ReviewErrorCode.BUDGET_EXHAUSTED,
  ReviewErrorCode.MODEL_INCOMPATIBLE,
  ReviewErrorCode.PROVIDER_REJECTED,
  ReviewErrorCode.AI_ERROR,
];

/**
 * Whether a failed run left a record on disk that a screen can open. Only a
 * failure the server reported from the report step has one, and
 * {@link PERSISTED_RUN_ERROR_CODES} is that step's whole vocabulary; a cancel, a
 * lost session and a failed save all settle before the write and can still
 * reach a screen with a completed lens streamed, so this is an allow-list
 * rather than a deny-list. The saved record is the source both surfaces read:
 * the stream still holds findings the server may have dropped, and two screens
 * must not disagree about a run.
 */
export function savedRunExists(
  lensStats: readonly LensStat[] | undefined,
  errorCode: string | null | undefined,
): boolean {
  return hasCompletedLens(lensStats) && PERSISTED_RUN_ERROR_CODES.includes(errorCode ?? "");
}

function getLensAgentName(lensId: LensId): string {
  return AGENT_METADATA[LENS_TO_AGENT[lensId]].name;
}

/** "A", "A and B", "A, B and C" — the sentence form, not a machine join. */
function formatList(items: readonly string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;
}
