/**
 * CLI-oriented display helpers for review progress steps.
 *
 * `mapStepStatus` maps schema step statuses to the 4-value CLI `UIStepStatus`
 * ("pending"/"running"/"complete"/"error"). The web progress view derives its
 * status from the same function via `mapStepsToProgressData` (progress-mapping.ts),
 * which collapses "error" to "pending" because the web `ProgressStatus` has no
 * "error" variant. This is the single source of truth for step-status mapping.
 */
import type { StepState, AgentState } from "@diffgazer/core/schemas/events";

export type UIStepStatus = "pending" | "running" | "complete" | "error";

export function mapStepStatus(status: StepState["status"]): UIStepStatus {
  switch (status) {
    case "active": return "running";
    case "completed": return "complete";
    case "error": return "error";
    default: return "pending";
  }
}

export function getAgentDetail(agent: AgentState): string {
  switch (agent.status) {
    case "running":
      return `${Math.round(agent.progress)}%${agent.currentAction ? ` ${agent.currentAction}` : ""}`;
    case "complete":
      return `${agent.issueCount} issue${agent.issueCount === 1 ? "" : "s"}`;
    case "error":
      return "error";
    default:
      return "queued";
  }
}
