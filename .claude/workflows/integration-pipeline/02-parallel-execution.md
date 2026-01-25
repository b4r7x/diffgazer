# Phase 2: Parallel Lens Execution

## Overview

Enable parallel execution of lenses using Promise.all for faster reviews and natural event interleaving.

**Priority:** CRITICAL
**Dependencies:** Phase 1 complete

---

## Context

### Current State
Lenses run sequentially in a for-loop:
```typescript
for (const lens of selectedLenses) {
  const issues = await runLens(lens);
  allIssues.push(...issues);
}
```

### Problem
- Sequential execution is slow (3 lenses = 3x wait time)
- No event interleaving (all agent_start events at beginning)
- Doesn't feel "agentic" (one at a time)

### Goal
```typescript
const results = await Promise.all(lenses.map(runLens));
```
- Parallel execution (3 lenses = ~1x wait time)
- Natural event interleaving (agents appear to work simultaneously)
- More "agentic" feel for the user

---

## Agent 2.1: Identify Current Implementation

```
subagent_type: "Explore"

Task: Find the exact location of sequential lens execution.

Read: packages/core/src/review/triage.ts

Find:
1. The triageReviewStream function
2. Where lenses are iterated
3. How events are emitted per lens
4. How results are aggregated

Answer:
1. What does the current loop look like?
2. Where is onEvent called?
3. How are issues collected?
4. What happens after all lenses complete?

Output: Exact code location and structure
```

---

## Agent 2.2: Refactor to Parallel Execution

```
subagent_type: "llm-application-dev:ai-engineer"

Task: Refactor triage to run lenses in parallel.

Read first:
- packages/core/src/review/triage.ts

Modify: packages/core/src/review/triage.ts

Find the sequential loop and replace with parallel execution:

```typescript
import { LENS_TO_AGENT, AGENT_METADATA } from '@repo/schemas';

export async function triageReviewStream(
  client: AIClient,
  diff: string,
  options: TriageOptions & {
    onEvent?: (event: AgentStreamEvent) => void;
  }
): Promise<Result<TriageResult, TriageError>> {
  const { lenses = DEFAULT_LENSES, onEvent, severityFilter, files } = options;

  // Filter diff to selected files if provided
  const filteredDiff = files ? filterDiffToFiles(diff, files) : diff;

  // Create lens execution promises
  const lensPromises = lenses.map(async (lensId) => {
    const agentId = LENS_TO_AGENT[lensId];
    const meta = AGENT_METADATA[agentId];

    // Emit agent start
    onEvent?.({
      type: 'agent_start',
      agent: meta,
      timestamp: new Date().toISOString(),
    });

    // Emit thinking
    onEvent?.({
      type: 'agent_thinking',
      agent: agentId,
      thought: `Analyzing code for ${meta.description.toLowerCase()}...`,
      timestamp: new Date().toISOString(),
    });

    try {
      // Run the lens review
      const issues = await runSingleLensReview(
        client,
        filteredDiff,
        lensId,
        (event) => onEvent?.(event), // Forward tool events
      );

      // Emit issues found
      for (const issue of issues) {
        onEvent?.({
          type: 'issue_found',
          agent: agentId,
          issue: {
            id: issue.id,
            severity: issue.severity,
            category: issue.category,
            title: issue.title,
            file: issue.file,
          },
          timestamp: new Date().toISOString(),
        });
      }

      // Emit agent complete
      onEvent?.({
        type: 'agent_complete',
        agent: agentId,
        issueCount: issues.length,
        timestamp: new Date().toISOString(),
      });

      return { ok: true as const, issues };
    } catch (error) {
      // Agent failed, but don't stop others
      onEvent?.({
        type: 'agent_complete',
        agent: agentId,
        issueCount: 0,
        timestamp: new Date().toISOString(),
      });

      return { ok: false as const, error };
    }
  });

  // Execute all lenses in parallel
  const results = await Promise.all(lensPromises);

  // Collect successful issues
  const allIssues: TriageIssue[] = [];
  for (const result of results) {
    if (result.ok) {
      allIssues.push(...result.issues);
    }
  }

  // Deduplicate issues by fingerprint
  const dedupedIssues = mergeIssues(allIssues);

  // Apply severity filter
  const filteredIssues = severityFilter
    ? dedupedIssues.filter(i => severityValue(i.severity) >= severityValue(severityFilter))
    : dedupedIssues;

  // Sort by severity
  const sortedIssues = sortBySeverity(filteredIssues);

  // Generate summary
  const summary = generateSummary(sortedIssues, lenses);

  // Emit orchestrator complete
  onEvent?.({
    type: 'orchestrator_complete',
    summary,
    totalIssues: sortedIssues.length,
    timestamp: new Date().toISOString(),
  });

  return ok({
    summary,
    issues: sortedIssues,
  });
}
```

Key changes:
1. `lenses.map()` instead of `for...of`
2. `Promise.all()` to run in parallel
3. Each lens emits its own events (naturally interleaved)
4. Error handling doesn't stop other lenses
5. Results collected after all complete

Steps:
1. Read current implementation
2. Identify the sequential loop
3. Replace with Promise.all pattern
4. Verify event emission points
5. Run: npm run type-check
6. Run: npx vitest run packages/core/src/review/triage.test.ts

Output: Parallel execution implemented
```

---

## Agent 2.3: Add Tool Call Events

```
subagent_type: "llm-application-dev:ai-engineer"

Task: Add tool_call and tool_result events when reading context.

Read first:
- packages/core/src/review/triage.ts
- packages/core/src/review/trace-recorder.ts

Modify: packages/core/src/review/triage.ts (inside runSingleLensReview)

When reading file context or doing other "tool" operations, emit events:

```typescript
async function runSingleLensReview(
  client: AIClient,
  diff: string,
  lensId: LensId,
  onEvent?: (event: AgentStreamEvent) => void
): Promise<TriageIssue[]> {
  const agentId = LENS_TO_AGENT[lensId];
  const lens = LENSES[lensId];

  // Parse diff to get file information
  const parsedDiff = parseDiff(diff);

  // Emit tool call for diff analysis
  onEvent?.({
    type: 'tool_call',
    agent: agentId,
    tool: 'analyzeDiff',
    input: `${parsedDiff.files.length} files, ${parsedDiff.hunks.length} hunks`,
    timestamp: new Date().toISOString(),
  });

  // Build prompt
  const prompt = buildTriagePrompt(diff, lens);

  onEvent?.({
    type: 'tool_result',
    agent: agentId,
    tool: 'analyzeDiff',
    summary: `Prepared ${prompt.length} chars for analysis`,
    timestamp: new Date().toISOString(),
  });

  // Call AI
  onEvent?.({
    type: 'tool_call',
    agent: agentId,
    tool: 'generateReview',
    input: `Using ${lens.name} lens`,
    timestamp: new Date().toISOString(),
  });

  const result = await client.generate<TriageResult>(prompt, TriageResultSchema);

  if (!result.ok) {
    throw new Error(result.error.message);
  }

  onEvent?.({
    type: 'tool_result',
    agent: agentId,
    tool: 'generateReview',
    summary: `Found ${result.value.issues.length} potential issues`,
    timestamp: new Date().toISOString(),
  });

  // Process and return issues
  return processIssues(result.value.issues, lensId);
}
```

This makes the agent's work visible:
- User sees "analyzeDiff: 5 files, 12 hunks"
- User sees "generateReview: Using Security lens"
- User sees "Found 3 potential issues"

Steps:
1. Identify tool-like operations
2. Add tool_call before each
3. Add tool_result after each
4. Run: npm run type-check

Output: Tool events added
```

---

## Agent 2.4: Add Thinking Messages

```
subagent_type: "llm-application-dev:ai-engineer"

Task: Add meaningful thinking messages for each agent.

Modify: packages/core/src/review/triage.ts

Create descriptive thinking messages based on lens:

```typescript
const AGENT_THOUGHTS: Record<AgentId, string[]> = {
  detective: [
    'Scanning for logic errors and edge cases...',
    'Checking null handling and type safety...',
    'Looking for potential runtime exceptions...',
  ],
  guardian: [
    'Scanning for OWASP Top 10 vulnerabilities...',
    'Checking for injection risks and data exposure...',
    'Analyzing authentication and authorization patterns...',
  ],
  optimizer: [
    'Identifying N+1 queries and inefficient patterns...',
    'Checking for memory leaks and resource issues...',
    'Looking for caching opportunities...',
  ],
  simplifier: [
    'Looking for over-engineered patterns...',
    'Checking code complexity and nesting depth...',
    'Identifying opportunities for simplification...',
  ],
  tester: [
    'Analyzing test coverage gaps...',
    'Checking test quality and assertions...',
    'Looking for missing edge case tests...',
  ],
};

// In the lens execution:
const thoughts = AGENT_THOUGHTS[agentId];
const randomThought = thoughts[Math.floor(Math.random() * thoughts.length)];

onEvent?.({
  type: 'agent_thinking',
  agent: agentId,
  thought: randomThought,
  timestamp: new Date().toISOString(),
});
```

This gives each agent personality and makes the review feel more "alive".

Steps:
1. Add AGENT_THOUGHTS constant
2. Select random thought per agent
3. Emit as agent_thinking event
4. Run: npm run type-check

Output: Thinking messages added
```

---

## Agent 2.5: Test Parallel Execution

```
subagent_type: "unit-testing:test-automator"

Task: Add test for parallel execution behavior.

Create: packages/core/src/review/triage-parallel.test.ts

```typescript
import { describe, it, expect, vi } from 'vitest';
import { triageReviewStream } from './triage';
import type { AgentStreamEvent } from '@repo/schemas';

describe('triageReviewStream parallel execution', () => {
  it('should emit agent_start events for all lenses near-simultaneously', async () => {
    const mockClient = createMockAIClient();
    const events: AgentStreamEvent[] = [];

    await triageReviewStream(mockClient, TEST_DIFF, {
      lenses: ['correctness', 'security', 'performance'],
      onEvent: (e) => events.push(e),
    });

    // Get all agent_start events
    const startEvents = events.filter(e => e.type === 'agent_start');

    // Should have 3 start events
    expect(startEvents).toHaveLength(3);

    // All should have timestamps within 100ms of each other (parallel)
    const timestamps = startEvents.map(e => new Date(e.timestamp).getTime());
    const maxDiff = Math.max(...timestamps) - Math.min(...timestamps);
    expect(maxDiff).toBeLessThan(100);
  });

  it('should emit events interleaved from different agents', async () => {
    const mockClient = createMockAIClient({
      delay: 50, // Add delay to see interleaving
    });
    const events: AgentStreamEvent[] = [];

    await triageReviewStream(mockClient, TEST_DIFF, {
      lenses: ['correctness', 'security'],
      onEvent: (e) => events.push(e),
    });

    // Check that events from different agents are interleaved
    const agentOrder = events
      .filter(e => 'agent' in e && typeof e.agent === 'string')
      .map(e => (e as any).agent);

    // Should not be all 'detective' then all 'guardian'
    // At minimum, should have some interleaving
    const detectiveIndices = agentOrder
      .map((a, i) => a === 'detective' ? i : -1)
      .filter(i => i >= 0);
    const guardianIndices = agentOrder
      .map((a, i) => a === 'guardian' ? i : -1)
      .filter(i => i >= 0);

    // If truly parallel, there should be some overlap
    // (not strictly sequential: all detective before guardian)
    if (detectiveIndices.length > 0 && guardianIndices.length > 0) {
      const detectiveMax = Math.max(...detectiveIndices);
      const guardianMin = Math.min(...guardianIndices);
      // Some interleaving expected
      expect(guardianMin).toBeLessThan(detectiveMax);
    }
  });

  it('should continue if one lens fails', async () => {
    const mockClient = createMockAIClient({
      failFor: ['security'], // Security lens will fail
    });
    const events: AgentStreamEvent[] = [];

    const result = await triageReviewStream(mockClient, TEST_DIFF, {
      lenses: ['correctness', 'security'],
      onEvent: (e) => events.push(e),
    });

    // Should still succeed with issues from working lens
    expect(result.ok).toBe(true);

    // Should have complete events for both agents
    const completeEvents = events.filter(e => e.type === 'agent_complete');
    expect(completeEvents).toHaveLength(2);
  });
});
```

Steps:
1. Create test file
2. Add mock AI client helper
3. Test parallel timing
4. Test event interleaving
5. Test error resilience
6. Run: npx vitest run packages/core/src/review/triage-parallel.test.ts

Output: Parallel execution tests
```

---

## Validation Checklist

- [ ] For-loop replaced with Promise.all
- [ ] All lenses start near-simultaneously
- [ ] Events naturally interleave
- [ ] Error in one lens doesn't stop others
- [ ] Issue deduplication still works
- [ ] Severity filtering still works
- [ ] orchestrator_complete emitted at end
- [ ] Tests pass
- [ ] Type check passes: npm run type-check

---

## Performance Expectations

### Before (Sequential)
- 3 lenses × 5 seconds each = 15 seconds total

### After (Parallel)
- 3 lenses in parallel = ~5 seconds total
- 3x faster!

### Event Interleaving
```
detective: agent_start
guardian: agent_start
optimizer: agent_start
detective: tool_call (analyzeDiff)
guardian: tool_call (analyzeDiff)
optimizer: tool_call (analyzeDiff)
detective: tool_result
guardian: tool_result
detective: issue_found (x2)
guardian: issue_found (x1)
optimizer: tool_result
detective: agent_complete
guardian: agent_complete
optimizer: agent_complete
orchestrator_complete
```

This feels much more like "multiple agents working together".
