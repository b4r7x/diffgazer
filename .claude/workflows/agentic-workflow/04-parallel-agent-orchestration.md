# Phase 4: Parallel Agent Orchestration

## Overview

Run lens agents in parallel instead of sequentially. This makes the review faster and creates a more dynamic "multiple agents working" experience.

## Goal

Before:
```
Detective starts → Detective finishes →
Guardian starts → Guardian finishes →
Optimizer starts → Optimizer finishes
```

After:
```
Detective starts ─────────┬─ Detective finishes
Guardian starts ──────────┤  Guardian finishes
Optimizer starts ─────────┴─ Optimizer finishes
                    (parallel)
```

---

## Agent 4.1: Parallel Lens Execution

```
subagent_type: "llm-application-dev:ai-engineer"

Task: Run lenses in parallel with interleaved event emission.

Modify: packages/core/src/review/triage.ts

## Current Implementation (Sequential)

for (const lens of selectedLenses) {
  const agentId = LENS_TO_AGENT[lens];
  onEvent({ type: "agent_start", ... });

  const issues = await runLensAnalysis(lens, diff, options);

  for (const issue of issues) {
    onEvent({ type: "issue_found", ... });
  }

  onEvent({ type: "agent_complete", ... });
  allIssues.push(...issues);
}

## New Implementation (Parallel)

// Create a promise for each lens
const lensPromises = selectedLenses.map(async (lens) => {
  const agentId = LENS_TO_AGENT[lens];
  const agentMeta = AGENT_METADATA[agentId];

  // Emit start event
  onEvent({
    type: "agent_start",
    agent: agentMeta,
    timestamp: new Date().toISOString(),
  });

  // Emit thinking event
  onEvent({
    type: "agent_thinking",
    agent: agentId,
    thought: `Analyzing code for ${lens} issues...`,
    timestamp: new Date().toISOString(),
  });

  // Run analysis (this is the async part)
  const issuesResult = await runLensAnalysis(lens, diff, options);

  if (!issuesResult.ok) {
    // Handle error but don't fail entire review
    onEvent({
      type: "agent_complete",
      agent: agentId,
      issueCount: 0,
      timestamp: new Date().toISOString(),
    });
    return [];
  }

  const issues = issuesResult.value;

  // Emit found events for each issue
  for (const issue of issues) {
    onEvent({
      type: "issue_found",
      agent: agentId,
      issue,
      timestamp: new Date().toISOString(),
    });
  }

  // Emit complete event
  onEvent({
    type: "agent_complete",
    agent: agentId,
    issueCount: issues.length,
    timestamp: new Date().toISOString(),
  });

  return issues;
});

// Wait for all lenses to complete
const allIssueArrays = await Promise.all(lensPromises);
const allIssues = allIssueArrays.flat();

// Deduplicate
const dedupedIssues = mergeIssues(allIssues);

// Final orchestrator complete event
onEvent({
  type: "orchestrator_complete",
  summary: generateSummary(dedupedIssues),
  totalIssues: dedupedIssues.length,
  timestamp: new Date().toISOString(),
});

## Event Interleaving

Because each lens runs asynchronously, events naturally interleave:

agent_start (detective)
agent_start (guardian)
agent_start (optimizer)
agent_thinking (detective)
agent_thinking (guardian)
issue_found (detective)
agent_thinking (optimizer)
issue_found (guardian)
agent_complete (detective)
issue_found (guardian)
agent_complete (optimizer)
agent_complete (guardian)
orchestrator_complete

This creates the "multiple agents working" feel.

## Error Handling

If one lens fails, others should continue:

const lensPromises = selectedLenses.map(async (lens) => {
  try {
    // ... lens analysis
    return issues;
  } catch (error) {
    // Log error, emit complete with 0 issues
    onEvent({
      type: "agent_complete",
      agent: agentId,
      issueCount: 0,
      timestamp: new Date().toISOString(),
    });
    return [];
  }
});

## Concurrency Limit (Optional)

If API rate limiting is a concern, limit concurrency:

import pLimit from "p-limit";
const limit = pLimit(2); // Max 2 concurrent

const lensPromises = selectedLenses.map((lens) =>
  limit(() => runLensWithEvents(lens))
);

But start without limit - simpler.

## Steps

1. Refactor sequential loop to Promise.all
2. Ensure each lens emits its own events
3. Handle per-lens errors gracefully
4. Test with multiple lenses
5. Run: npm run type-check && npx vitest run

Output: Parallel lens execution implemented
```

---

## Agent 4.2: Progress Tracking

```
subagent_type: "react-component-architect"

Task: Enhance progress tracking for parallel execution.

Modify: apps/cli/src/features/review/hooks/use-agent-activity.ts

## Current Progress (Equal Distribution)

const progressPerAgent = 100 / agents.length;
// Queued = 0%, Running = 50%, Complete = 100%

## Enhanced Progress

Add timing-based estimation for running agents:

interface AgentState {
  // ... existing fields
  startedAt?: string;  // When agent_start received
  completedAt?: string; // When agent_complete received
}

## Track Timing from Events

case "agent_start":
  agent.status = "running";
  agent.startedAt = event.timestamp;
  break;

case "agent_complete":
  agent.status = "complete";
  agent.completedAt = event.timestamp;
  break;

## Running Agent Progress (Optional)

For running agents, estimate progress based on elapsed time vs average completion time.

But simpler: just show indeterminate "running" state.
Don't over-engineer progress bars.

## Total Issues Counter

Track issues as they're found:

const totalIssuesFound = events.filter(
  (e) => e.type === "issue_found"
).length;

Display in panel:
"3 issues found so far..."

## Activity Summary

const activitySummary = {
  queued: agents.filter((a) => a.status === "queued").length,
  running: agents.filter((a) => a.status === "running").length,
  complete: agents.filter((a) => a.status === "complete").length,
};

Display: "2 of 4 agents complete"

## Steps

1. Add startedAt/completedAt to state derivation
2. Calculate totalIssuesFound from events
3. Add activitySummary calculation
4. Export new values from hook
5. Run: npm run type-check

Output: Progress tracking enhanced
```

---

## Agent 4.3: Update Panel to Show Parallel Activity

```
subagent_type: "react-component-architect"

Task: Update panel to better show parallel execution.

Modify: apps/cli/src/features/review/components/agent-activity-panel.tsx

## Show Multiple Running Agents

When multiple agents are running, show all their actions:

┌─────────────────────┐
│ Agents ██░░░░ 25%   │
│ 2 of 4 running      │
├─────────────────────┤
│ ▶ 🔍 Detective      │
│   └─ Analyzing diff │
│ ▶ 🔒 Guardian       │
│   └─ Reading auth.ts│
│ ○ ⚡ Optimizer       │
│ ○ 🧹 Simplifier     │
├─────────────────────┤
│ 3 issues found      │
└─────────────────────┘

## Header Enhancement

Show running count and found issues:

<Box flexDirection="column">
  <Box>
    <Text>Agents </Text>
    <ProgressBar value={progress} width={8} />
    <Text> {Math.round(progress)}%</Text>
  </Box>
  <Text color="gray">
    {activitySummary.running > 0
      ? `${activitySummary.running} running`
      : `${activitySummary.complete} complete`}
  </Text>
</Box>

## Footer with Issue Count

{totalIssuesFound > 0 && (
  <Box borderStyle="single" borderTop borderBottom={false}>
    <Text color="yellow">
      {totalIssuesFound} issue{totalIssuesFound !== 1 ? "s" : ""} found
    </Text>
  </Box>
)}

## Steps

1. Add props for activitySummary and totalIssuesFound
2. Update header to show running count
3. Add footer with issue count
4. Test with multiple running agents
5. Run: npm run type-check

Output: Panel shows parallel activity
```

---

## Why This Design

### Promise.all vs Promise.allSettled

We use `Promise.all` with try/catch per lens instead of `Promise.allSettled` because:
- We want to handle errors per-lens, not globally
- We still want to collect successful results
- Simpler code, same behavior

### Natural Event Interleaving

We don't need to artificially interleave events. JavaScript's async execution naturally interleaves:
- Each lens starts almost simultaneously
- AI calls are async (network)
- Events fire as each completes
- Results come in unpredictable order

This is the "feel" we want - multiple agents working at once.

### No Artificial Delays

Don't add `setTimeout` to "spread out" events. The natural timing is better:
- Fast API = fast feedback
- Slow API = user sees "thinking" longer
- Realistic representation of actual work
