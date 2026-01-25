# Phase 3: Agent Activity Panel

## Overview

Create the UI components that show agent activity in real-time. This is the most visible part of the "agentic" experience.

## Goal

User sees:
```
┌─────────────────────┐
│ Agent Activity      │
├─────────────────────┤
│ ✓ 🔍 Detective  (3) │
│ ⟳ 🔒 Guardian       │
│   └─ Reading auth.ts│
│ ○ ⚡ Optimizer       │
└─────────────────────┘
```

---

## Agent 3.1: Agent Activity State Hook

```
subagent_type: "react-component-architect"

Task: Create hook to manage agent activity state from SSE events.

Location: apps/cli/src/features/review/hooks/use-agent-activity.ts

## Hook Interface

export function useAgentActivity(
  events: AgentStreamEvent[],
  selectedLenses: LensId[]
): {
  agents: AgentState[];
  currentAction: string | null;
  isRunning: boolean;
  progress: number;
  totalIssuesFound: number;
}

## State Derivation

Initialize agents from selectedLenses:

const initialAgents = selectedLenses.map((lens) => {
  const agentId = LENS_TO_AGENT[lens];
  return {
    id: agentId,
    meta: AGENT_METADATA[agentId],
    status: "queued" as const,
    progress: 0,
    issueCount: 0,
    currentAction: undefined,
  };
});

Process events to update state:

for (const event of events) {
  switch (event.type) {
    case "agent_start":
      // Set agent status to "running"
      break;
    case "agent_thinking":
      // Update agent's currentAction
      break;
    case "tool_call":
      // Update agent's currentAction with tool info
      break;
    case "tool_result":
      // Clear currentAction or update summary
      break;
    case "issue_found":
      // Increment agent's issueCount
      break;
    case "agent_complete":
      // Set agent status to "complete"
      break;
  }
}

## Progress Calculation

Each agent contributes equally:
- Queued = 0%
- Running = 50% of share
- Complete = 100% of share

const progressPerAgent = 100 / agents.length;
const progress = agents.reduce((sum, agent) => {
  switch (agent.status) {
    case "queued": return sum + 0;
    case "running": return sum + progressPerAgent * 0.5;
    case "complete": return sum + progressPerAgent;
  }
}, 0);

## Current Action

Find the first running agent's current action:

const runningAgent = agents.find((a) => a.status === "running");
const currentAction = runningAgent?.currentAction ?? null;

## Implementation

import { useMemo } from "react";
import {
  AgentStreamEvent,
  AgentState,
  LensId,
  LENS_TO_AGENT,
  AGENT_METADATA,
} from "@repo/schemas";

export function useAgentActivity(
  events: AgentStreamEvent[],
  selectedLenses: LensId[]
) {
  return useMemo(() => {
    // Initialize agents
    const agentMap = new Map<string, AgentState>();
    for (const lens of selectedLenses) {
      const agentId = LENS_TO_AGENT[lens];
      agentMap.set(agentId, {
        id: agentId,
        meta: AGENT_METADATA[agentId],
        status: "queued",
        progress: 0,
        issueCount: 0,
      });
    }

    // Process events
    for (const event of events) {
      // ... update agentMap based on event type
    }

    const agents = Array.from(agentMap.values());
    // ... calculate progress, currentAction, etc.

    return { agents, currentAction, isRunning, progress, totalIssuesFound };
  }, [events, selectedLenses]);
}

## Steps

1. Create apps/cli/src/features/review/hooks/use-agent-activity.ts
2. Implement state derivation logic
3. Calculate progress and current action
4. Export from features/review/hooks/index.ts
5. Run: npm run type-check

Output: Agent activity hook created
```

---

## Agent 3.2: Agent Activity Panel Component

```
subagent_type: "react-component-architect"

Task: Create UI component showing agent activity.

Location: apps/cli/src/features/review/components/agent-activity-panel.tsx

## Component Interface

interface AgentActivityPanelProps {
  agents: AgentState[];
  currentAction: string | null;
  progress: number;
  height?: number;
}

export function AgentActivityPanel({
  agents,
  currentAction,
  progress,
  height,
}: AgentActivityPanelProps): JSX.Element

## Layout

┌─────────────────────┐
│ Agents ████░░░ 60%  │  <- header with progress bar
├─────────────────────┤
│ ✓ 🔍 Detective  (3) │  <- complete, green, issue count
│ ⟳ 🔒 Guardian       │  <- running, cyan, spinner
│   └─ Reading auth.ts│  <- current action, indented
│ ○ ⚡ Optimizer       │  <- queued, dim
│ ○ 🧹 Simplifier     │
└─────────────────────┘

## Visual States

Queued:
- Symbol: ○ (empty circle)
- Color: dim gray
- No action shown

Running:
- Symbol: ⟳ (spinning) or just ▶
- Color: cyan
- Show current action indented below

Complete:
- Symbol: ✓ (checkmark)
- Color: green
- Show issue count in parentheses
- If issueCount > 0, count is yellow

## Implementation

import { Box, Text } from "ink";
import chalk from "chalk";

export function AgentActivityPanel({ agents, currentAction, progress }: Props) {
  return (
    <Box flexDirection="column" borderStyle="single" paddingX={1}>
      {/* Header with progress */}
      <Box>
        <Text>Agents </Text>
        <ProgressBar value={progress} width={10} />
        <Text> {Math.round(progress)}%</Text>
      </Box>

      {/* Agent list */}
      {agents.map((agent) => (
        <AgentRow key={agent.id} agent={agent} />
      ))}
    </Box>
  );
}

function AgentRow({ agent }: { agent: AgentState }) {
  const symbol = getSymbol(agent.status);
  const color = getColor(agent.status);
  const issueText = agent.status === "complete" && agent.issueCount > 0
    ? ` (${agent.issueCount})`
    : "";

  return (
    <Box flexDirection="column">
      <Text color={color}>
        {symbol} {agent.meta.emoji} {agent.meta.name}
        <Text color={agent.issueCount > 0 ? "yellow" : undefined}>
          {issueText}
        </Text>
      </Text>
      {agent.status === "running" && agent.currentAction && (
        <Text color="gray">  └─ {agent.currentAction}</Text>
      )}
    </Box>
  );
}

function getSymbol(status: AgentStatus): string {
  switch (status) {
    case "queued": return "○";
    case "running": return "▶";
    case "complete": return "✓";
  }
}

function getColor(status: AgentStatus): string {
  switch (status) {
    case "queued": return "gray";
    case "running": return "cyan";
    case "complete": return "green";
  }
}

## Progress Bar Component

Simple ASCII progress bar:

function ProgressBar({ value, width }: { value: number; width: number }) {
  const filled = Math.round((value / 100) * width);
  const empty = width - filled;
  return (
    <Text>
      <Text color="green">{"█".repeat(filled)}</Text>
      <Text color="gray">{"░".repeat(empty)}</Text>
    </Text>
  );
}

## Steps

1. Create apps/cli/src/features/review/components/agent-activity-panel.tsx
2. Implement AgentActivityPanel component
3. Implement AgentRow helper
4. Implement ProgressBar helper
5. Export from features/review/components/index.ts
6. Run: npm run type-check

Output: Agent activity panel created
```

---

## Agent 3.3: Integrate Panel into Review Screen

```
subagent_type: "react-component-architect"

Task: Add agent activity panel to review split-screen.

Modify: apps/cli/src/features/review/components/review-split-screen.tsx

## New Props

interface ReviewSplitScreenProps {
  // Existing props
  issues: TriageIssue[];
  selectedIssueId: string | null;
  onSelectIssue: (id: string) => void;
  // ... etc

  // New props for agent activity
  agentEvents?: AgentStreamEvent[];
  selectedLenses?: LensId[];
  isReviewing?: boolean;
}

## Layout During Review (3 columns)

When isReviewing is true:

<Box flexDirection="row" height={height}>
  {/* Agent activity - fixed width */}
  <Box width={24}>
    <AgentActivityPanel
      agents={agentActivity.agents}
      currentAction={agentActivity.currentAction}
      progress={agentActivity.progress}
    />
  </Box>

  {/* Split pane for issues and details */}
  <SplitPane leftWidth="40%">
    <IssueListPane issues={issues} ... />
    <IssueDetailsPane issue={selectedIssue} ... />
  </SplitPane>
</Box>

## Layout After Review (2 columns)

When isReviewing is false or undefined:

<SplitPane leftWidth="40%">
  <IssueListPane issues={issues} ... />
  <IssueDetailsPane issue={selectedIssue} ... />
</SplitPane>

## Using the Hook

import { useAgentActivity } from "../hooks/use-agent-activity";

function ReviewSplitScreen({ agentEvents, selectedLenses, isReviewing, ...props }) {
  const agentActivity = useAgentActivity(
    agentEvents ?? [],
    selectedLenses ?? []
  );

  // ... render with conditional layout
}

## Steps

1. Import AgentActivityPanel and useAgentActivity
2. Add new props to interface
3. Implement conditional 3-column / 2-column layout
4. Pass events to useAgentActivity hook
5. Render AgentActivityPanel when reviewing
6. Run: npm run type-check

Output: Agent panel integrated
```

---

## Why This Design

### useMemo for State Derivation

We use `useMemo` instead of `useReducer` because:
- Events are the source of truth (from SSE)
- State is derived, not accumulated
- Simpler mental model
- No action dispatch needed

### Fixed Width for Activity Panel

Activity panel has fixed width (24 chars) because:
- Agent names and status have predictable length
- Prevents layout shift as agents progress
- Keeps focus on issues list

### Conditional Layout

Hide activity panel after review because:
- Once complete, agents are no longer interesting
- More space for issue details
- Cleaner final view
