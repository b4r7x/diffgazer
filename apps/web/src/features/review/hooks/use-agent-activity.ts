import { useMemo } from 'react';
import type { AgentStreamEvent, AgentState, AgentId } from '@repo/schemas';
import { AGENT_METADATA } from '@repo/schemas';

interface AgentActivityState {
    agents: AgentState[];
    currentAction: string | null;
    progress: number;
    totalIssues: number;
}

export function useAgentActivity(events: AgentStreamEvent[]): AgentActivityState {
    return useMemo(() => {
        const agentStates = new Map<AgentId, AgentState>();
        let currentAction: string | null = null;
        let totalIssues = 0;

        // Initialize all agents as queued
        for (const [id, meta] of Object.entries(AGENT_METADATA)) {
            agentStates.set(id as AgentId, {
                id: id as AgentId,
                meta,
                status: 'queued',
                progress: 0,
                issueCount: 0,
            });
        }

        // Process events to update agent states
        for (const event of events) {
            switch (event.type) {
                case 'agent_start': {
                    const state = agentStates.get(event.agent.id);
                    if (state) {
                        state.status = 'running';
                        state.progress = 10;
                    }
                    break;
                }
                case 'agent_thinking': {
                    const state = agentStates.get(event.agent);
                    if (state) {
                        state.currentAction = event.thought;
                        currentAction = event.thought;
                    }
                    break;
                }
                case 'tool_call': {
                    currentAction = `${event.tool}: ${event.input}`;
                    const state = agentStates.get(event.agent);
                    if (state) {
                        state.currentAction = currentAction;
                        state.lastToolCall = event.tool;
                        state.progress = Math.min(state.progress + 10, 90);
                    }
                    break;
                }
                case 'tool_result': {
                    const state = agentStates.get(event.agent);
                    if (state) {
                        state.currentAction = event.summary;
                    }
                    break;
                }
                case 'issue_found': {
                    const state = agentStates.get(event.agent);
                    if (state) {
                        state.issueCount++;
                    }
                    totalIssues++;
                    break;
                }
                case 'agent_complete': {
                    const state = agentStates.get(event.agent);
                    if (state) {
                        state.status = 'complete';
                        state.progress = 100;
                        state.currentAction = undefined;
                    }
                    currentAction = null;
                    break;
                }
            }
        }

        const agents = Array.from(agentStates.values());
        const completedCount = agents.filter((a) => a.status === 'complete').length;
        const progress = agents.length > 0 ? (completedCount / agents.length) * 100 : 0;

        return { agents, currentAction, progress, totalIssues };
    }, [events]);
}
