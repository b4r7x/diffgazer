import { useMemo } from 'react';
import type { AgentStreamEvent } from '@repo/schemas';
import { calculateAgentActivity, type AgentActivityState } from '@repo/core/review/browser';

export type { AgentActivityState };

export function useAgentActivity(events: AgentStreamEvent[]): AgentActivityState {
    return useMemo(() => calculateAgentActivity(events), [events]);
}
