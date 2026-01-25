# Phase 2: Agent Stream Events

## Overview

Update the triage system to emit agent events during execution. This enables real-time visibility of what agents are doing.

## Goal

Transform hidden AI work into visible agent activity:
- User sees when each agent starts
- User sees tool calls (reading files, searching)
- User sees issues as they're found
- User sees when agents complete

---

## Agent 2.1: Emit Agent Events from Triage

```
subagent_type: "llm-application-dev:ai-engineer"

Task: Update triage to emit agent stream events.

Modify: packages/core/src/review/triage.ts

## Current Implementation

export async function triageReview(
  options: TriageOptions
): Promise<Result<TriageResult, TriageError>>

Runs lenses sequentially, returns final result.

## New Streaming Variant

Add a new function that accepts an event callback:

export async function triageReviewStream(
  options: TriageOptions,
  onEvent: (event: AgentStreamEvent) => void
): Promise<Result<TriageResult, TriageError>>

## Event Emission Points

### 1. When starting a lens

const agentId = LENS_TO_AGENT[lens];
const agentMeta = AGENT_METADATA[agentId];
onEvent({
  type: "agent_start",
  agent: agentMeta,
  timestamp: new Date().toISOString(),
});

### 2. Before AI analysis

onEvent({
  type: "agent_thinking",
  agent: agentId,
  thought: `Analyzing ${fileCount} files for ${lens} issues...`,
  timestamp: new Date().toISOString(),
});

### 3. When reading context (optional, if applicable)

// If triage reads additional file context
onEvent({
  type: "tool_call",
  agent: agentId,
  tool: "readDiff",
  input: `${changedFiles.length} files`,
  timestamp: new Date().toISOString(),
});

### 4. When AI returns issues

// For each issue found
for (const issue of lensIssues) {
  onEvent({
    type: "issue_found",
    agent: agentId,
    issue,
    timestamp: new Date().toISOString(),
  });
}

### 5. When lens completes

onEvent({
  type: "agent_complete",
  agent: agentId,
  issueCount: lensIssues.length,
  timestamp: new Date().toISOString(),
});

### 6. When all lenses complete

onEvent({
  type: "orchestrator_complete",
  summary: result.summary,
  totalIssues: result.issues.length,
  timestamp: new Date().toISOString(),
});

## Keep Original Function Working

export async function triageReview(
  options: TriageOptions
): Promise<Result<TriageResult, TriageError>> {
  // Call streaming version with no-op callback
  return triageReviewStream(options, () => {});
}

## Implementation Notes

- Events should be emitted synchronously (onEvent is sync)
- Don't await onEvent - it's fire-and-forget
- Include timestamp in all events for ordering
- Use LENS_TO_AGENT to get agentId from lens
- Use AGENT_METADATA to get full agent info

## Steps

1. Import AgentStreamEvent, LENS_TO_AGENT, AGENT_METADATA from schemas
2. Create triageReviewStream function signature
3. Refactor triageReview to call triageReviewStream
4. Add event emission at all points listed above
5. Run: npm run type-check && npx vitest run

Output: Triage emits agent events
```

---

## Agent 2.2: Update SSE Route to Stream Agent Events

```
subagent_type: "backend-development:backend-architect"

Task: Update triage SSE endpoint to emit agent events.

Modify: apps/server/src/api/routes/triage.ts

## Current SSE Events

- lens_start
- lens_complete
- complete
- error

## New SSE Events (Forward All AgentStreamEvent Types)

Forward each AgentStreamEvent as an SSE event:

app.get("/triage/stream", async (c) => {
  return streamSSE(c, async (stream) => {
    // ... setup ...

    const result = await triageReviewStream(options, (event) => {
      // Forward all agent events to SSE
      stream.writeSSE({
        event: event.type,  // "agent_start", "tool_call", etc.
        data: JSON.stringify(event),
      });
    });

    // Final complete event (if not error)
    if (result.ok) {
      stream.writeSSE({
        event: "complete",
        data: JSON.stringify({
          reviewId: savedReview.id,
          result: result.value,
        }),
      });
    }
  });
});

## SSE Format

event: agent_start
data: {"type":"agent_start","agent":{"id":"guardian","lens":"security","name":"Guardian","emoji":"🔒"},"timestamp":"2025-01-25T12:00:00Z"}

event: tool_call
data: {"type":"tool_call","agent":"guardian","tool":"readFile","input":"src/auth.ts:42-55","timestamp":"2025-01-25T12:00:01Z"}

event: issue_found
data: {"type":"issue_found","agent":"guardian","issue":{...},"timestamp":"2025-01-25T12:00:02Z"}

event: agent_complete
data: {"type":"agent_complete","agent":"guardian","issueCount":2,"timestamp":"2025-01-25T12:00:03Z"}

## Keep Backwards Compatibility

Existing events (complete, error) should still work.
New events are additive.

## Steps

1. Import triageReviewStream (instead of triageReview)
2. Import AgentStreamEvent type
3. Update stream handler to forward events
4. Test with curl or EventSource
5. Run: npm run type-check

## Testing

curl -N "http://localhost:7860/triage/stream?staged=false&lenses=security,correctness"

Should see interleaved events from both agents.

Output: SSE emits agent events
```

---

## Why This Design

### Callback vs Observable

We use a simple callback `(event: AgentStreamEvent) => void` instead of RxJS or EventEmitter because:
- Simpler, no new dependencies
- Works with any consumer (SSE, WebSocket, logs)
- Easy to test (pass mock callback)

### Fire-and-Forget Events

Events are emitted synchronously and not awaited because:
- We don't want event delivery to slow down analysis
- SSE can buffer events if needed
- If event fails, analysis should continue

### All Events Same Format

Every event has same structure (`type`, `timestamp`, payload) for:
- Easy parsing on client
- Consistent SSE format
- Simple state machine in UI
