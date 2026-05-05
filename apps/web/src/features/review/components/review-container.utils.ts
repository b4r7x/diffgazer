import type { ProgressStepData, ProgressStatus } from '@/components/ui/progress';
import type { StepState, AgentState, AgentStatus } from '@diffgazer/core/schemas/events';
import type { ProgressSubstepData } from '@diffgazer/core/schemas/ui';
import { getAgentDetail } from '@diffgazer/core/review';
import { truncate } from '@diffgazer/core/strings';

function mapStepStatus(status: StepState['status']): ProgressStatus {
  return status === 'error' ? 'pending' : status;
}

function mapAgentToSubstepStatus(agentStatus: AgentStatus): ProgressSubstepData['status'] {
  switch (agentStatus) {
    case 'queued': return 'pending';
    case 'running': return 'active';
    case 'complete': return 'completed';
    case 'error': return 'error';
  }
}

function getSubstepDetail(agent: AgentState): string {
  if (agent.status === 'running' && agent.currentAction) {
    return `${Math.round(agent.progress)}% · ${truncate(agent.currentAction, 40)}`;
  }
  return getAgentDetail(agent);
}

function deriveSubstepsFromAgents(agents: AgentState[]): ProgressSubstepData[] {
  return agents.map(agent => ({
    id: agent.id,
    tag: agent.meta.badgeLabel,
    label: agent.meta.name,
    status: mapAgentToSubstepStatus(agent.status),
    detail: getSubstepDetail(agent),
  }));
}

export function mapStepsToProgressData(
  steps: StepState[],
  agents: AgentState[]
): ProgressStepData[] {
  return steps.map(step => {
    const substeps = step.id === 'review' && agents.length > 0
      ? deriveSubstepsFromAgents(agents)
      : undefined;

    return {
      id: step.id,
      label: step.label,
      status: mapStepStatus(step.status),
      substeps,
    };
  });
}
