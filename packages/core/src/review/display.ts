/**
 * CLI-oriented display helpers for review progress steps.
 *
 * `mapStepStatus` maps schema-aligned step statuses ("active"/"completed"/"pending")
 * to CLI naming conventions ("running"/"complete"/"error"/"pending"). The web app has
 * its own `mapStepStatus` in `apps/web/src/features/review/components/review-container.utils.ts`
 * because it maps to a 3-value `ProgressStatus` type ("active"/"completed"/"pending")
 * with no "error" variant (errors fall back to "pending").
 *
 * This is intentional divergence — the web and CLI have different UI status models,
 * not a duplication bug.
 */
import type { StepState, AgentState } from "@diffgazer/schemas/events";

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
