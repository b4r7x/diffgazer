import type { ProgressStepData, ProgressStatus } from '@/components/ui/progress';
import type { StepState, AgentState, AgentStatus } from '@stargazer/schemas/events';
import type { ProgressSubstepData } from '@stargazer/schemas/ui';

export function mapStepStatus(status: StepState['status']): ProgressStatus {
  return status === 'error' ? 'pending' : status;
}

export function mapAgentToSubstepStatus(agentStatus: AgentStatus): ProgressSubstepData['status'] {
  switch (agentStatus) {
    case 'queued': return 'pending';
    case 'running': return 'active';
    case 'complete': return 'completed';
    case 'error': return 'error';
  }
}

export function truncateText(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  return value.slice(0, maxLength - 3) + '...';
}

function getSubstepDetail(agent: AgentState): string {
  switch (agent.status) {
    case 'running':
      return `${Math.round(agent.progress)}%${agent.currentAction ? ` · ${truncateText(agent.currentAction, 40)}` : ''}`;
    case 'complete':
      return `${agent.issueCount} issue${agent.issueCount === 1 ? '' : 's'}`;
    case 'error':
      return 'error';
    default:
      return 'queued';
  }
}

export function deriveSubstepsFromAgents(agents: AgentState[]): ProgressSubstepData[] {
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
