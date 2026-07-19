import type { AgentState, AgentStatus, StepState } from "../schemas/events/index.js";
import type {
  ProgressStatus,
  ProgressStepData,
  ProgressStepWithSubstepsData,
  ProgressSubstepData,
} from "../schemas/presentation/index.js";
import { truncate } from "../strings.js";
import {
  getAgentDetail,
  mapStepStatus as mapStepStatusCore,
  type UIStepStatus,
} from "./display.js";

const STATUS_TO_PROGRESS: Record<UIStepStatus, ProgressStatus> = {
  pending: "pending",
  running: "active",
  complete: "completed",
  error: "pending",
};

function mapStepStatusToProgress(status: StepState["status"]): ProgressStatus {
  const coreStatus = mapStepStatusCore(status);
  return STATUS_TO_PROGRESS[coreStatus];
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

export function mapStepsToProgressData(steps: StepState[]): ProgressStepData[] {
  return steps.map((step) => ({
    id: step.id,
    label: step.label,
    status: mapStepStatusToProgress(step.status),
  }));
}

export function mapStepsToProgressDataWithAgents(
  steps: StepState[],
  agents: AgentState[],
): ProgressStepWithSubstepsData[] {
  return mapStepsToProgressData(steps).map((step) => ({
    ...step,
    substeps:
      step.id === "review" && agents.length > 0 ? deriveSubstepsFromAgents(agents) : undefined,
  }));
}
