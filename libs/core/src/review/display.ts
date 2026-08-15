/**
 * Display helpers for review progress steps shared by web and TUI.
 *
 * `mapStepStatus` maps schema step statuses to the 4-value `UIStepStatus`
 * ("pending"/"running"/"complete"/"error"). Both surfaces derive their progress
 * rows from the same function via `mapStepsToProgressData` (progress-mapping.ts),
 * which maps "error" to the shared `ProgressStatus` error variant.
 */
import type { AgentState, StepState } from "../schemas/events/index.js";
import { pluralize } from "../strings.js";

export type UIStepStatus = "pending" | "running" | "complete" | "error";

export function mapStepStatus(status: StepState["status"]): UIStepStatus {
  switch (status) {
    case "pending":
      return "pending";
    case "active":
      return "running";
    case "completed":
      return "complete";
    case "error":
      return "error";
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}

export function getAgentDetail(agent: AgentState): string {
  switch (agent.status) {
    case "running":
      return `${Math.round(agent.progress)}%${agent.currentAction ? ` ${agent.currentAction}` : ""}`;
    case "complete":
      return pluralize(agent.issueCount, "issue");
    case "error":
      return "error";
    case "queued":
      return "queued";
    default: {
      const _exhaustive: never = agent.status;
      return _exhaustive;
    }
  }
}
