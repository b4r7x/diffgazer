import { useState, useEffect } from "react";
import type { AgentStreamEvent } from "@repo/schemas/agent-event";
import { calculateAgentActivity, type AgentActivityState } from "@repo/core/review";

export type { AgentActivityState };

export function useAgentActivity(events: AgentStreamEvent[]): AgentActivityState {
  const [state, setState] = useState<AgentActivityState>(() => calculateAgentActivity(events));

  useEffect(() => {
    setState(calculateAgentActivity(events));
  }, [events]);

  return state;
}
