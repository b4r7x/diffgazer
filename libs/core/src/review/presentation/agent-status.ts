import type { AgentState, AgentStatus, LensStat } from "../../schemas/events/index.js";
import { pluralize } from "../../strings.js";

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
