import { useState, useEffect } from "react";
import type {
  AgentStreamEvent,
  AgentState,
  AgentId,
  AgentMeta,
} from "@repo/schemas/agent-event";
import { AGENT_METADATA } from "@repo/schemas/agent-event";

export interface AgentActivityState {
  agents: AgentState[];
  currentAction: string | null;
  isRunning: boolean;
  progress: number;
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
  };
}

function calculateProgress(agents: AgentState[]): number {
  if (agents.length === 0) return 0;

  const sharePerAgent = 100 / agents.length;
  let total = 0;

  for (const agent of agents) {
    if (agent.status === "complete") {
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

export function useAgentActivity(
  events: AgentStreamEvent[]
): AgentActivityState {
  const [agents, setAgents] = useState<AgentState[]>([]);

  useEffect(() => {
    const agentMap = new Map<AgentId, AgentState>();

    for (const event of events) {
      switch (event.type) {
        case "agent_start": {
          const agentId = event.agent.id;
          const existing = agentMap.get(agentId);
          agentMap.set(agentId, {
            ...(existing ?? createInitialAgentState(agentId)),
            meta: event.agent,
            status: "running",
          });
          break;
        }

        case "tool_call": {
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

        case "tool_result": {
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
            });
          }
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
      }
    }

    setAgents(Array.from(agentMap.values()));
  }, [events]);

  const isRunning = agents.some((a) => a.status === "running");
  const progress = calculateProgress(agents);
  const currentAction = findCurrentAction(agents);

  return {
    agents,
    currentAction,
    isRunning,
    progress,
  };
}
