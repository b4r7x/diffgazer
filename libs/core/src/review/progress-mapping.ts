import type { AgentState, AgentStatus, StepState } from "../schemas/events/index.js";
import type {
  ProgressStatus,
  ProgressStepData,
  ProgressSubstepData,
} from "../schemas/presentation/index.js";
import { truncate } from "../strings.js";
import { getAgentDetail, mapStepStatus as mapStepStatusCore } from "./display.js";

const STATUS_TO_PROGRESS: Record<string, ProgressStatus> = {
  pending: "pending",
  running: "active",
  complete: "completed",
  error: "pending",
};

function mapStepStatusToProgress(status: StepState["status"]): ProgressStatus {
  const coreStatus = mapStepStatusCore(status);
  return STATUS_TO_PROGRESS[coreStatus] ?? "pending";
}

function mapAgentToSubstepStatus(agentStatus: AgentStatus): ProgressSubstepData["status"] {
  switch (agentStatus) {
    case "queued":
      return "pending";
    case "running":
      return "active";
    case "complete":
      return "completed";
    case "error":
      return "error";
  }
}

function getSubstepDetail(agent: AgentState): string {
  if (agent.status === "running" && agent.currentAction) {
    return `${Math.round(agent.progress)}% · ${truncate(agent.currentAction, 40)}`;
  }
  return getAgentDetail(agent);
}

function deriveSubstepsFromAgents(agents: AgentState[]): ProgressSubstepData[] {
  return agents.map((agent) => ({
    id: agent.id,
    tag: agent.meta.badgeLabel,
    label: agent.meta.name,
    status: mapAgentToSubstepStatus(agent.status),
    detail: getSubstepDetail(agent),
  }));
}

export function mapStepsToProgressData(
  steps: StepState[],
  agents: AgentState[],
): ProgressStepData[] {
  return steps.map((step) => {
    const substeps =
      step.id === "review" && agents.length > 0 ? deriveSubstepsFromAgents(agents) : undefined;

    return {
      id: step.id,
      label: step.label,
      status: mapStepStatusToProgress(step.status),
      substeps,
    };
  });
}
