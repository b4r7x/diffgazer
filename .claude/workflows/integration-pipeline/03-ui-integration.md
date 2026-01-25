# Phase 3: UI Integration

## Overview

Connect the CLI UI to receive and display agent stream events in real-time.

**Priority:** CRITICAL
**Dependencies:** Phases 1-2 complete

---

## Context

### Current State
- AgentActivityPanel component exists but receives no events
- useTriage hook doesn't capture agent events
- Review view doesn't show agent activity during review

### Goal
- User sees agents working in real-time
- Tool calls visible as they happen
- Issues appear as found
- Smooth transition from reviewing to complete

---

## Agent 3.1: Update Triage API Client

```
subagent_type: "react-component-architect"

Task: Update CLI triage API to parse and forward agent events from SSE.

Read first:
- apps/cli/src/features/review/api/triage-api.ts
- packages/schemas/src/agent-event.ts
- packages/schemas/src/stream-events.ts

Modify: apps/cli/src/features/review/api/triage-api.ts

The streamTriage function currently parses SSE but may not handle all agent events.

Update to:

1. Add AgentStreamEvent to imports:
```typescript
import type { AgentStreamEvent, TriageResult } from '@repo/schemas';
```

2. Add callback to options:
```typescript
interface StreamTriageOptions {
  diff: string;
  lenses?: string[];
  profile?: string;
  staged?: boolean;
  files?: string[];
  onAgentEvent?: (event: AgentStreamEvent) => void;
  onProgress?: (progress: number) => void;
  onIssue?: (issue: TriageIssue) => void;
}
```

3. In SSE event handler, forward agent events:
```typescript
const handleSSEEvent = (eventType: string, data: string) => {
  try {
    const parsed = JSON.parse(data);

    // Handle agent events
    if ([
      'agent_start',
      'agent_thinking',
      'tool_call',
      'tool_result',
      'issue_found',
      'agent_complete',
      'orchestrator_complete'
    ].includes(parsed.type)) {
      options.onAgentEvent?.(parsed as AgentStreamEvent);
    }

    // Also handle specific cases
    if (parsed.type === 'issue_found') {
      options.onIssue?.(parsed.issue);
    }

    if (parsed.type === 'complete') {
      // Final result
      return parsed.result;
    }
  } catch (e) {
    console.error('Failed to parse SSE event:', e);
  }
};
```

Steps:
1. Read current implementation
2. Add AgentStreamEvent import
3. Update options interface
4. Add event forwarding logic
5. Run: npm run type-check

Output: API forwards agent events
```

---

## Agent 3.2: Update useTriage Hook

```
subagent_type: "react-component-architect"

Task: Update useTriage hook to capture and expose agent events.

Read first:
- apps/cli/src/features/review/hooks/use-triage.ts
- apps/cli/src/features/review/api/triage-api.ts

Modify: apps/cli/src/features/review/hooks/use-triage.ts

Add state for agent events:

```typescript
import { useState, useCallback } from 'react';
import type { AgentStreamEvent, TriageResult, TriageIssue } from '@repo/schemas';

interface UseTriageState {
  status: 'idle' | 'loading' | 'success' | 'error';
  result: TriageResult | null;
  error: Error | null;
  agentEvents: AgentStreamEvent[];
  issues: TriageIssue[]; // Issues as they arrive
}

export function useTriage() {
  const [state, setState] = useState<UseTriageState>({
    status: 'idle',
    result: null,
    error: null,
    agentEvents: [],
    issues: [],
  });

  const startTriage = useCallback(async (options: TriageOptions) => {
    // Reset state
    setState({
      status: 'loading',
      result: null,
      error: null,
      agentEvents: [],
      issues: [],
    });

    try {
      const result = await streamTriage({
        ...options,
        onAgentEvent: (event) => {
          setState(prev => ({
            ...prev,
            agentEvents: [...prev.agentEvents, event],
          }));
        },
        onIssue: (issue) => {
          setState(prev => ({
            ...prev,
            issues: [...prev.issues, issue],
          }));
        },
      });

      if (result.ok) {
        setState(prev => ({
          ...prev,
          status: 'success',
          result: result.value,
        }));
      } else {
        setState(prev => ({
          ...prev,
          status: 'error',
          error: new Error(result.error.message),
        }));
      }
    } catch (e) {
      setState(prev => ({
        ...prev,
        status: 'error',
        error: e instanceof Error ? e : new Error('Unknown error'),
      }));
    }
  }, []);

  const reset = useCallback(() => {
    setState({
      status: 'idle',
      result: null,
      error: null,
      agentEvents: [],
      issues: [],
    });
  }, []);

  return {
    ...state,
    isLoading: state.status === 'loading',
    isError: state.status === 'error',
    isSuccess: state.status === 'success',
    startTriage,
    reset,
  };
}
```

Steps:
1. Read current implementation
2. Add agentEvents to state
3. Add issues accumulator
4. Wire to streamTriage callbacks
5. Export new state
6. Run: npm run type-check

Output: useTriage exposes agent events
```

---

## Agent 3.3: Wire useAgentActivity to Events

```
subagent_type: "react-component-architect"

Task: Ensure useAgentActivity derives state from event stream.

Read first:
- apps/cli/src/features/review/hooks/use-agent-activity.ts
- packages/schemas/src/agent-event.ts

Verify/Modify: apps/cli/src/features/review/hooks/use-agent-activity.ts

The hook should derive agent states from events:

```typescript
import { useMemo } from 'react';
import type { AgentStreamEvent, AgentState, AgentId } from '@repo/schemas';
import { AGENT_METADATA, AGENT_IDS } from '@repo/schemas';

export function useAgentActivity(events: AgentStreamEvent[]) {
  return useMemo(() => {
    // Initialize all agents as queued
    const agentStates = new Map<AgentId, AgentState>();

    for (const id of AGENT_IDS) {
      agentStates.set(id, {
        id,
        meta: AGENT_METADATA[id],
        status: 'queued',
        progress: 0,
        issueCount: 0,
      });
    }

    let currentAction: string | null = null;
    let totalIssues = 0;

    // Process events to derive state
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
          const state = agentStates.get(event.agent);
          if (state) {
            state.lastToolCall = `${event.tool}: ${event.input}`;
            state.currentAction = `${event.tool}: ${event.input}`;
            currentAction = `${event.tool}: ${event.input}`;
            state.progress = 50;
          }
          break;
        }
        case 'tool_result': {
          const state = agentStates.get(event.agent);
          if (state) {
            state.currentAction = event.summary;
            currentAction = event.summary;
          }
          break;
        }
        case 'issue_found': {
          const state = agentStates.get(event.agent);
          if (state) {
            state.issueCount++;
            totalIssues++;
          }
          break;
        }
        case 'agent_complete': {
          const state = agentStates.get(event.agent);
          if (state) {
            state.status = 'complete';
            state.progress = 100;
            state.currentAction = undefined;
            state.issueCount = event.issueCount;
          }
          break;
        }
      }
    }

    // Calculate overall progress
    const agents = Array.from(agentStates.values())
      .filter(a => a.status !== 'queued' || events.some(e =>
        e.type === 'agent_start' && e.agent.id === a.id
      ));

    const runningOrComplete = agents.filter(a =>
      a.status === 'running' || a.status === 'complete'
    );

    const progress = runningOrComplete.length === 0
      ? 0
      : runningOrComplete.reduce((sum, a) => sum + a.progress, 0) / runningOrComplete.length;

    const isRunning = agents.some(a => a.status === 'running');

    return {
      agents,
      currentAction,
      progress,
      isRunning,
      totalIssues,
    };
  }, [events]);
}
```

Steps:
1. Read current implementation
2. Verify it processes all event types
3. Add any missing event handlers
4. Ensure correct progress calculation
5. Run: npm run type-check

Output: Agent activity derived from events
```

---

## Agent 3.4: Update Review View with Agent Panel

```
subagent_type: "react-component-architect"

Task: Integrate agent activity panel into the review view.

Read first:
- apps/cli/src/app/views/review-view.tsx
- apps/cli/src/features/review/components/agent-activity-panel.tsx
- apps/cli/src/features/review/components/review-split-screen.tsx

Modify: apps/cli/src/app/views/review-view.tsx

Add agent panel that shows during review:

```tsx
import { Box } from 'ink';
import { AgentActivityPanel } from '@/features/review/components/agent-activity-panel';
import { ReviewSplitScreen } from '@/features/review/components/review-split-screen';
import { useTriage } from '@/features/review/hooks/use-triage';
import { useAgentActivity } from '@/features/review/hooks/use-agent-activity';

interface ReviewViewProps {
  initialOptions?: TriageOptions;
}

export function ReviewView({ initialOptions }: ReviewViewProps) {
  const {
    status,
    result,
    error,
    agentEvents,
    issues,
    isLoading,
    startTriage,
  } = useTriage();

  const {
    agents,
    currentAction,
    progress,
    isRunning,
    totalIssues,
  } = useAgentActivity(agentEvents);

  // Auto-start if options provided
  useEffect(() => {
    if (initialOptions && status === 'idle') {
      startTriage(initialOptions);
    }
  }, [initialOptions, status, startTriage]);

  // Show agent panel during review
  if (isLoading) {
    return (
      <Box flexDirection="column" padding={1}>
        <AgentActivityPanel
          agents={agents}
          currentAction={currentAction}
          progress={progress}
          isRunning={isRunning}
        />

        {/* Show issues as they arrive */}
        {issues.length > 0 && (
          <Box marginTop={1}>
            <Text dimColor>
              Found {issues.length} issue{issues.length !== 1 ? 's' : ''} so far...
            </Text>
          </Box>
        )}
      </Box>
    );
  }

  // Show error
  if (error) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text color="red">Error: {error.message}</Text>
      </Box>
    );
  }

  // Show results in split screen
  if (result) {
    return (
      <ReviewSplitScreen
        issues={result.issues}
        summary={result.summary}
        agentEvents={agentEvents}
        showAgentPanel={false} // Can toggle for history
      />
    );
  }

  // Idle state - shouldn't normally reach here
  return (
    <Box padding={1}>
      <Text dimColor>Ready to review. Run a command to start.</Text>
    </Box>
  );
}
```

Key behaviors:
1. During review: Full-screen AgentActivityPanel
2. Issues appear as found (preview)
3. On complete: Transition to ReviewSplitScreen
4. Agent panel can optionally stay visible

Steps:
1. Import required components and hooks
2. Set up state with useTriage
3. Derive agent state with useAgentActivity
4. Conditional render based on status
5. Wire auto-start if options provided
6. Run: npm run type-check

Output: Review view shows agent activity
```

---

## Agent 3.5: Update Interactive Review App

```
subagent_type: "react-component-architect"

Task: Wire the interactive review app to use the updated review view.

Read first:
- apps/cli/src/features/review/apps/interactive-review-app.tsx
- apps/cli/src/app/views/review-view.tsx

Modify: apps/cli/src/features/review/apps/interactive-review-app.tsx

Ensure the app passes options to ReviewView and handles navigation:

```tsx
import { useState, useCallback } from 'react';
import { Box } from 'ink';
import { ReviewView } from '@/app/views/review-view';
import { FilePickerView } from '@/features/review/components/file-picker';

type AppState =
  | { screen: 'file-picker' }
  | { screen: 'reviewing', options: TriageOptions }
  | { screen: 'complete', result: TriageResult };

interface InteractiveReviewAppProps {
  initialDiff?: string;
  initialOptions?: Partial<TriageOptions>;
}

export function InteractiveReviewApp({
  initialDiff,
  initialOptions,
}: InteractiveReviewAppProps) {
  const [state, setState] = useState<AppState>(() => {
    // If we have a diff, start reviewing immediately
    if (initialDiff) {
      return {
        screen: 'reviewing',
        options: {
          diff: initialDiff,
          lenses: initialOptions?.lenses ?? ['correctness', 'security'],
          ...initialOptions,
        },
      };
    }
    return { screen: 'file-picker' };
  });

  const handleFilesSelected = useCallback((files: string[], diff: string) => {
    setState({
      screen: 'reviewing',
      options: {
        diff,
        files,
        lenses: initialOptions?.lenses ?? ['correctness', 'security'],
      },
    });
  }, [initialOptions?.lenses]);

  const handleBack = useCallback(() => {
    setState({ screen: 'file-picker' });
  }, []);

  switch (state.screen) {
    case 'file-picker':
      return (
        <FilePickerView
          onSelect={handleFilesSelected}
          onCancel={() => process.exit(0)}
        />
      );

    case 'reviewing':
      return (
        <ReviewView
          initialOptions={state.options}
          onBack={handleBack}
        />
      );

    default:
      return null;
  }
}
```

Steps:
1. Read current implementation
2. Ensure state machine handles all screens
3. Pass options to ReviewView
4. Handle back navigation
5. Run: npm run type-check

Output: Interactive app flows correctly
```

---

## Agent 3.6: Add Live Issue Counter to Agent Panel

```
subagent_type: "react-component-architect"

Task: Update agent activity panel to show live issue count and progress bar.

Read first:
- apps/cli/src/features/review/components/agent-activity-panel.tsx

Modify: apps/cli/src/features/review/components/agent-activity-panel.tsx

Enhance the panel with:
1. Overall progress bar
2. Total issues found
3. Current action with spinner

```tsx
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';
import type { AgentState } from '@repo/schemas';

interface AgentActivityPanelProps {
  agents: AgentState[];
  currentAction: string | null;
  progress: number;
  isRunning: boolean;
}

export function AgentActivityPanel({
  agents,
  currentAction,
  progress,
  isRunning,
}: AgentActivityPanelProps) {
  const totalIssues = agents.reduce((sum, a) => sum + a.issueCount, 0);
  const completeCount = agents.filter(a => a.status === 'complete').length;
  const activeCount = agents.filter(a => a.status === 'running').length;

  return (
    <Box flexDirection="column" borderStyle="round" paddingX={1}>
      {/* Header */}
      <Box justifyContent="space-between">
        <Text bold>Agent Activity</Text>
        <Text dimColor>
          {completeCount}/{agents.length} complete
        </Text>
      </Box>

      {/* Progress bar */}
      <Box marginY={1}>
        <ProgressBar progress={progress} width={40} />
        <Text dimColor> {Math.round(progress)}%</Text>
      </Box>

      {/* Agent list */}
      {agents.map((agent) => (
        <AgentRow key={agent.id} agent={agent} />
      ))}

      {/* Current action */}
      {currentAction && (
        <Box marginTop={1}>
          <Text dimColor>
            <Spinner type="dots" /> {currentAction}
          </Text>
        </Box>
      )}

      {/* Issue summary */}
      {totalIssues > 0 && (
        <Box marginTop={1}>
          <Text color="yellow">
            Found {totalIssues} issue{totalIssues !== 1 ? 's' : ''} so far
          </Text>
        </Box>
      )}
    </Box>
  );
}

function AgentRow({ agent }: { agent: AgentState }) {
  const statusIcon = {
    queued: '○',
    running: '◐',
    complete: '●',
  }[agent.status];

  const statusColor = {
    queued: 'gray',
    running: 'cyan',
    complete: 'green',
  }[agent.status] as 'gray' | 'cyan' | 'green';

  return (
    <Box>
      <Text color={statusColor}>{statusIcon}</Text>
      <Text> {agent.meta.emoji} </Text>
      <Text bold={agent.status === 'running'}>{agent.meta.name}</Text>
      {agent.issueCount > 0 && (
        <Text color="yellow"> ({agent.issueCount})</Text>
      )}
      {agent.status === 'running' && agent.currentAction && (
        <Text dimColor> - {agent.currentAction}</Text>
      )}
    </Box>
  );
}

function ProgressBar({ progress, width }: { progress: number; width: number }) {
  const filled = Math.round((progress / 100) * width);
  const empty = width - filled;

  return (
    <Text>
      <Text color="green">{'█'.repeat(filled)}</Text>
      <Text color="gray">{'░'.repeat(empty)}</Text>
    </Text>
  );
}
```

Steps:
1. Read current implementation
2. Add progress bar component
3. Add issue counter
4. Add current action with spinner
5. Style agent rows properly
6. Run: npm run type-check

Output: Enhanced agent panel
```

---

## Validation Checklist

- [ ] streamTriage API forwards agent events
- [ ] useTriage hook exposes agentEvents array
- [ ] useAgentActivity derives correct state from events
- [ ] ReviewView shows agent panel during loading
- [ ] Agent panel shows progress bar
- [ ] Agent panel shows issue counts per agent
- [ ] Current action visible with spinner
- [ ] Transition to split screen on complete
- [ ] All type checks pass: npm run type-check
