# Phase 3: Review Feature

Create the review feature with API, hooks, and components.

## Agent

```
subagent_type: "frontend-developer"
```

## Tasks

### 3.1 Review API

Create `src/features/review/api/review-api.ts`:

```typescript
import type {
  TriageOptions,
  TriageResult,
  AgentStreamEvent,
  ReviewHistoryEntry,
} from '@repo/schemas';

const API_BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:7860';

export async function streamTriage(
  options: TriageOptions,
  onEvent: (event: AgentStreamEvent) => void
): Promise<TriageResult> {
  const response = await fetch(`${API_BASE}/triage/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Origin': window.location.origin,
    },
    credentials: 'include',
    body: JSON.stringify(options),
  });

  if (!response.ok) {
    throw new Error(`Triage failed: ${response.status}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error('No response body');

  const decoder = new TextDecoder();
  let buffer = '';
  let result: TriageResult | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6);
        if (data === '[DONE]') continue;

        try {
          const event = JSON.parse(data) as AgentStreamEvent;
          onEvent(event);

          if (event.type === 'orchestrator_complete') {
            result = event.result;
          }
        } catch {
          // Skip invalid JSON
        }
      }
    }
  }

  if (!result) throw new Error('No result received');
  return result;
}

export async function getReviews(): Promise<ReviewHistoryEntry[]> {
  const response = await fetch(`${API_BASE}/reviews`, {
    credentials: 'include',
  });
  if (!response.ok) throw new Error(`Failed to fetch reviews: ${response.status}`);
  return response.json();
}

export async function getReview(id: string): Promise<TriageResult> {
  const response = await fetch(`${API_BASE}/reviews/${id}`, {
    credentials: 'include',
  });
  if (!response.ok) throw new Error(`Failed to fetch review: ${response.status}`);
  return response.json();
}
```

### 3.2 Triage Stream Hook

Create `src/features/review/hooks/use-triage-stream.ts`:

```typescript
import { useState, useCallback, useRef } from 'react';
import { streamTriage } from '../api/review-api';
import type { AgentStreamEvent, TriageIssue, TriageOptions, TriageResult } from '@repo/schemas';

interface UseTriageStreamReturn {
  events: AgentStreamEvent[];
  issues: TriageIssue[];
  result: TriageResult | null;
  isRunning: boolean;
  error: Error | null;
  start: (options: TriageOptions) => Promise<TriageResult>;
  stop: () => void;
}

export function useTriageStream(): UseTriageStreamReturn {
  const [events, setEvents] = useState<AgentStreamEvent[]>([]);
  const [issues, setIssues] = useState<TriageIssue[]>([]);
  const [result, setResult] = useState<TriageResult | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const start = useCallback(async (options: TriageOptions): Promise<TriageResult> => {
    setIsRunning(true);
    setEvents([]);
    setIssues([]);
    setResult(null);
    setError(null);

    abortRef.current = new AbortController();

    try {
      const triageResult = await streamTriage(options, (event) => {
        setEvents((prev) => [...prev, event]);

        if (event.type === 'issue_found') {
          setIssues((prev) => [...prev, event.issue]);
        }
      });

      setResult(triageResult);
      return triageResult;
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      setError(err);
      throw err;
    } finally {
      setIsRunning(false);
    }
  }, []);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    setIsRunning(false);
  }, []);

  return { events, issues, result, isRunning, error, start, stop };
}
```

### 3.3 Agent Activity Hook

Create `src/features/review/hooks/use-agent-activity.ts`:

```typescript
import { useMemo } from 'react';
import type { AgentStreamEvent, AgentState, AgentId, AgentMeta } from '@repo/schemas';
import { AGENT_METADATA } from '@repo/schemas';

interface UseAgentActivityReturn {
  agents: AgentState[];
  currentAction: string | null;
  progress: number;
  totalIssues: number;
}

export function useAgentActivity(events: AgentStreamEvent[]): UseAgentActivityReturn {
  return useMemo(() => {
    const agentStates = new Map<AgentId, AgentState>();
    let currentAction: string | null = null;
    let totalIssues = 0;

    // Initialize agents
    for (const [id, meta] of Object.entries(AGENT_METADATA)) {
      agentStates.set(id as AgentId, {
        id: id as AgentId,
        meta: meta as AgentMeta,
        status: 'queued',
        progress: 0,
        issueCount: 0,
      });
    }

    // Process events
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
          currentAction = event.thought;
          break;
        }
        case 'tool_call': {
          currentAction = `${event.tool}: ${event.input}`;
          const state = agentStates.get(event.agent);
          if (state) {
            state.currentAction = currentAction;
            state.progress = 50;
          }
          break;
        }
        case 'tool_result': {
          const state = agentStates.get(event.agent);
          if (state) {
            state.currentAction = undefined;
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
          }
          currentAction = null;
          break;
        }
      }
    }

    const agents = Array.from(agentStates.values());
    const activeAgents = agents.filter((a) => a.meta); // Only show agents that are configured
    const completedCount = activeAgents.filter((a) => a.status === 'complete').length;
    const progress = activeAgents.length > 0 ? (completedCount / activeAgents.length) * 100 : 0;

    return { agents: activeAgents, currentAction, progress, totalIssues };
  }, [events]);
}
```

### 3.4 Severity Badge Component

Create `src/features/review/components/severity-badge.tsx`:

```typescript
import { Badge } from '@/components/ui/badge';
import type { TriageSeverity } from '@repo/schemas';

const SEVERITY_EMOJI: Record<TriageSeverity, string> = {
  blocker: '🔴',
  high: '🟠',
  medium: '🟡',
  low: '🔵',
  nit: '⚪',
};

interface SeverityBadgeProps {
  severity: TriageSeverity;
  showEmoji?: boolean;
}

export function SeverityBadge({ severity, showEmoji = true }: SeverityBadgeProps) {
  return (
    <Badge variant={severity}>
      {showEmoji && <span className="mr-1">{SEVERITY_EMOJI[severity]}</span>}
      {severity.toUpperCase()}
    </Badge>
  );
}
```

### 3.5 Agent Status Component

Create `src/features/agents/components/agent-status.tsx`:

```typescript
import { cn } from '@/lib/utils';
import type { AgentState } from '@repo/schemas';

interface AgentStatusProps {
  agent: AgentState;
}

export function AgentStatus({ agent }: AgentStatusProps) {
  const { meta, status, issueCount, currentAction } = agent;

  return (
    <div className="flex items-start gap-2 py-1">
      <span className="text-lg">{meta.emoji}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <StatusIcon status={status} />
          <span className={cn(
            'font-medium',
            status === 'queued' && 'text-muted-foreground',
            status === 'running' && 'text-cyan-500',
            status === 'complete' && 'text-green-500'
          )}>
            {meta.name}
          </span>
          {issueCount > 0 && (
            <span className="text-sm text-yellow-500">({issueCount})</span>
          )}
        </div>
        {currentAction && (
          <div className="text-xs text-muted-foreground truncate mt-0.5">
            └─ {currentAction}
          </div>
        )}
      </div>
    </div>
  );
}

function StatusIcon({ status }: { status: AgentState['status'] }) {
  switch (status) {
    case 'queued':
      return <span className="text-muted-foreground">○</span>;
    case 'running':
      return <span className="text-cyan-500 animate-spin">⟳</span>;
    case 'complete':
      return <span className="text-green-500">✓</span>;
    default:
      return null;
  }
}
```

### 3.6 Agent Activity Panel

Create `src/features/review/components/agent-activity-panel.tsx`:

```typescript
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { AgentStatus } from '@/features/agents/components/agent-status';
import type { AgentState } from '@repo/schemas';

interface AgentActivityPanelProps {
  agents: AgentState[];
  progress: number;
  currentAction: string | null;
  totalIssues: number;
}

export function AgentActivityPanel({
  agents,
  progress,
  currentAction,
  totalIssues,
}: AgentActivityPanelProps) {
  const activeAgents = agents.filter((a) => a.status !== 'queued' || a.meta);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center justify-between">
          <span>Agent Activity</span>
          <span className="text-muted-foreground">
            {totalIssues} issue{totalIssues !== 1 ? 's' : ''} found
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Progress value={progress} className="mb-4" />
        <div className="space-y-1">
          {activeAgents.map((agent) => (
            <AgentStatus key={agent.id} agent={agent} />
          ))}
        </div>
        {currentAction && (
          <div className="mt-2 text-xs text-muted-foreground truncate">
            {currentAction}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

### 3.7 Issue Card Component

Create `src/features/review/components/issue-card.tsx`:

```typescript
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { SeverityBadge } from './severity-badge';
import { cn } from '@/lib/utils';
import type { TriageIssue } from '@repo/schemas';

interface IssueCardProps {
  issue: TriageIssue;
  isSelected?: boolean;
  onClick?: () => void;
}

export function IssueCard({ issue, isSelected, onClick }: IssueCardProps) {
  return (
    <Card
      className={cn(
        'cursor-pointer transition-colors',
        isSelected && 'ring-2 ring-primary',
        !isSelected && 'hover:bg-muted/50'
      )}
      onClick={onClick}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <h4 className="font-medium text-sm leading-tight">{issue.title}</h4>
          <SeverityBadge severity={issue.severity} />
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {issue.file && (
          <div className="text-xs text-muted-foreground font-mono">
            {issue.file}
            {issue.line_start && `:${issue.line_start}`}
            {issue.line_end && issue.line_end !== issue.line_start && `-${issue.line_end}`}
          </div>
        )}
        {issue.rationale && (
          <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
            {issue.rationale}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
```

### 3.8 Create Index Files

Create `src/features/review/api/index.ts`:
```typescript
export * from './review-api';
```

Create `src/features/review/hooks/index.ts`:
```typescript
export * from './use-triage-stream';
export * from './use-agent-activity';
```

Create `src/features/review/components/index.ts`:
```typescript
export * from './severity-badge';
export * from './agent-activity-panel';
export * from './issue-card';
```

Create `src/features/review/index.ts`:
```typescript
export * from './api';
export * from './hooks';
export * from './components';
```

## Validation

```bash
pnpm type-check
```

## Output

Review feature created:
- API layer with SSE streaming
- useTriageStream hook
- useAgentActivity hook
- AgentActivityPanel component
- IssueCard component
- SeverityBadge component
