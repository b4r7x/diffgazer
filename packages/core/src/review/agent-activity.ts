import type { AgentStreamEvent, AgentState, AgentId, AgentMeta } from "@stargazer/schemas/agent-event";
import { AGENT_METADATA } from "@stargazer/schemas/agent-event";

export interface AgentActivityState {
  agents: AgentState[];
  currentAction: string | null;
  isRunning: boolean;
  progress: number;
  totalIssues: number;
}

function createInitialAgentState(agentId: AgentId): AgentState {
  return {
    id: agentId,
    meta: AGENT_METADATA[agentId],
    status: "queued",
    progress: 0,
    issueCount: 0,
    currentAction: undefined,
    lastToolCall: undefined,
    error: undefined,
    startedAt: undefined,
    completedAt: undefined,
  };
}

function calculateProgress(agents: AgentState[]): number {
  if (agents.length === 0) return 0;

  const sharePerAgent = 100 / agents.length;
  let total = 0;

  for (const agent of agents) {
    if (agent.status === "complete") {
      total += sharePerAgent;
    } else if (agent.status === "error") {
      total += sharePerAgent;
    } else if (agent.status === "running") {
      total += sharePerAgent * 0.5;
    }
  }

  return Math.round(total * 10) / 10;
}

function findCurrentAction(agents: AgentState[]): string | null {
  for (const agent of agents) {
    if (agent.status === "running" && agent.currentAction) {
      return agent.currentAction;
    }
  }
  return null;
}

export function createInitialAgentActivityState(): AgentActivityState {
  return {
    agents: [],
    currentAction: null,
    isRunning: false,
    progress: 0,
    totalIssues: 0,
  };
}

export function calculateAgentActivity(events: AgentStreamEvent[]): AgentActivityState {
  const agentMap = new Map<AgentId, AgentState>();
  let totalIssues = 0;

  for (const event of events) {
    switch (event.type) {
      case "agent_queued": {
        const agentId = event.agent.id;
        const existing = agentMap.get(agentId);
        agentMap.set(agentId, {
          ...(existing ?? createInitialAgentState(agentId)),
          meta: event.agent,
          status: "queued",
        });
        break;
      }
      case "agent_start": {
        const agentId = event.agent.id;
        const existing = agentMap.get(agentId);
        agentMap.set(agentId, {
          ...(existing ?? createInitialAgentState(agentId)),
          meta: event.agent,
          status: "running",
          startedAt: event.timestamp,
        });
        break;
      }

      case "agent_thinking": {
        const existing = agentMap.get(event.agent);
        if (existing) {
          agentMap.set(event.agent, {
            ...existing,
            currentAction: event.thought,
          });
        }
        break;
      }

      case "agent_progress": {
        const existing = agentMap.get(event.agent);
        if (existing) {
          agentMap.set(event.agent, {
            ...existing,
            progress: event.progress,
            currentAction: event.message ?? existing.currentAction,
          });
        }
        break;
      }

      case "tool_call":
      case "tool_start": {
        const existing = agentMap.get(event.agent);
        if (existing) {
          agentMap.set(event.agent, {
            ...existing,
            currentAction: `${event.tool}: ${event.input}`,
            lastToolCall: event.tool,
          });
        }
        break;
      }

      case "tool_result":
      case "tool_end": {
        const existing = agentMap.get(event.agent);
        if (existing) {
          agentMap.set(event.agent, {
            ...existing,
            currentAction: event.summary || undefined,
          });
        }
        break;
      }

      case "issue_found": {
        const existing = agentMap.get(event.agent);
        if (existing) {
          agentMap.set(event.agent, {
            ...existing,
            issueCount: existing.issueCount + 1,
          });
        }
        totalIssues++;
        break;
      }

      case "agent_error": {
        const existing = agentMap.get(event.agent);
        if (existing) {
          agentMap.set(event.agent, {
            ...existing,
            status: "error",
            error: event.error,
            currentAction: "Failed",
            progress: 100,
            completedAt: event.timestamp,
          });
        }
        break;
      }

      case "agent_complete": {
        const existing = agentMap.get(event.agent);
        if (existing) {
          agentMap.set(event.agent, {
            ...existing,
            status: "complete",
            progress: 100,
            currentAction: undefined,
            issueCount: event.issueCount,
            completedAt: event.timestamp,
          });
        }
        break;
      }
    }
  }

  const agents = Array.from(agentMap.values());
  const isRunning = agents.some((a) => a.status === "running");
  const progress = calculateProgress(agents);
  const currentAction = findCurrentAction(agents);

  return {
    agents,
    currentAction,
    isRunning,
    progress,
    totalIssues,
  };
}
