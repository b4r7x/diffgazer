import {
  AGENT_METADATA,
  type AgentState,
  type AgentStatus,
  LENS_TO_AGENT,
  type LensStat,
} from "../../schemas/events/index.js";
import type { LensId } from "../../schemas/review/index.js";
import { pluralize } from "../../strings.js";
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

  const names = failed.map((stat) => getLensAgentName(stat.lensId));
  const missing = formatList(names);
  return `Partial run — ${scope}${reason}. Issues from ${missing} are missing.`;
}

function getLensAgentName(lensId: LensId): string {
  return AGENT_METADATA[LENS_TO_AGENT[lensId]].name;
}

/** "A", "A and B", "A, B and C" — the sentence form, not a machine join. */
function formatList(items: readonly string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;
}
