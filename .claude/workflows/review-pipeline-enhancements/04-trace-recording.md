# Phase 4: Trace Recording

## Overview

Implement trace recording to show users what the AI did during drilldown analysis.

**Priority:** HIGH
**Dependencies:** Phase 3 (for UI components)

---

## Context

### What is Trace Recording?

Trace is an audit trail of what the AI did:
- Which files it read
- What searches it performed
- How long each step took
- What the AI concluded

Example trace:
```
## Trace (4 steps)

1. readFileRange                     00:00.12
   src/auth.ts:35-60
   > 26 lines read

2. searchRepo                        00:00.34
   "password validation"
   > 3 matches found

3. readFileRange                     00:00.08
   src/validation.ts:10-40
   > 31 lines read

4. generateAnalysis                  00:02.15
   issue analysis
   > Analysis complete
```

### Why Trace?

- **Transparency:** User sees how AI reached conclusions
- **Trust:** Verify AI looked at relevant code
- **Debugging:** When AI is wrong, see what it missed
- **Learning:** Understand AI's analysis process

---

## Existing Code References

Read these files first:
- `packages/schemas/src/triage.ts` - TraceRef type
- `packages/core/src/review/drilldown.ts` - Drilldown function
- `apps/cli/src/features/review/components/issue-body-trace.tsx` - If exists

---

## Agent 4.1: Trace Recorder Utility

```
subagent_type: "backend-development:backend-architect"

Task: Create utility class to record AI tool calls.

Create: packages/core/src/review/trace-recorder.ts

IMPORTANT:
- Records input/output/timing for each tool call
- Generates TraceRef[] compatible with schema
- Thread-safe (no shared state issues)

Implementation:

import type { TraceRef } from '@repo/schemas';

interface TraceStep {
  tool: string;
  inputSummary: string;
  outputSummary: string;
  startTime: number;
  endTime?: number;
  artifacts?: string[];
}

export class TraceRecorder {
  private steps: TraceStep[] = [];
  private startTime: number;

  constructor() {
    this.startTime = Date.now();
  }

  /**
   * Wrap an async function to record its execution.
   *
   * @param toolName - Name of the tool/operation (e.g., "readFileRange")
   * @param inputSummary - Short description of input (e.g., "src/auth.ts:35-60")
   * @param fn - The async function to execute
   * @param summarizeOutput - Optional function to summarize output
   */
  async wrap<T>(
    toolName: string,
    inputSummary: string,
    fn: () => Promise<T>,
    summarizeOutput?: (result: T) => string
  ): Promise<T> {
    const step: TraceStep = {
      tool: toolName,
      inputSummary,
      outputSummary: '',
      startTime: Date.now(),
    };

    try {
      const result = await fn();
      step.endTime = Date.now();
      step.outputSummary = summarizeOutput
        ? summarizeOutput(result)
        : this.defaultSummary(result);
      this.steps.push(step);
      return result;
    } catch (error) {
      step.endTime = Date.now();
      step.outputSummary = `Error: ${error instanceof Error ? error.message : String(error)}`;
      this.steps.push(step);
      throw error;
    }
  }

  /**
   * Record a step manually (for non-async operations).
   */
  record(
    toolName: string,
    inputSummary: string,
    outputSummary: string,
    artifacts?: string[]
  ): void {
    const now = Date.now();
    this.steps.push({
      tool: toolName,
      inputSummary,
      outputSummary,
      startTime: now,
      endTime: now,
      artifacts,
    });
  }

  /**
   * Get all recorded steps as TraceRef array.
   */
  getTrace(): TraceRef[] {
    return this.steps.map((step, index) => ({
      step: index + 1,
      tool: step.tool,
      inputSummary: step.inputSummary,
      outputSummary: step.outputSummary,
      timestamp: new Date(step.startTime).toISOString(),
      durationMs: step.endTime ? step.endTime - step.startTime : undefined,
      artifacts: step.artifacts,
    }));
  }

  /**
   * Get total duration.
   */
  getTotalDuration(): number {
    return Date.now() - this.startTime;
  }

  /**
   * Clear all recorded steps.
   */
  clear(): void {
    this.steps = [];
    this.startTime = Date.now();
  }

  private defaultSummary(result: unknown): string {
    if (result === null || result === undefined) {
      return 'No result';
    }
    if (typeof result === 'string') {
      const lines = result.split('\n').length;
      return `${lines} lines`;
    }
    if (Array.isArray(result)) {
      return `${result.length} items`;
    }
    if (typeof result === 'object') {
      return 'Object returned';
    }
    return String(result).slice(0, 50);
  }
}

// Helper for common summarizers
export const summarizers = {
  fileContent: (content: string) => {
    const lines = content.split('\n').length;
    return `${lines} lines read`;
  },
  searchResults: (results: unknown[]) => {
    return `${results.length} matches found`;
  },
  analysis: () => 'Analysis complete',
};

Update: packages/core/src/review/index.ts
- Export TraceRecorder and summarizers

Steps:
1. Create trace-recorder.ts
2. Export from index.ts
3. Run: npm run type-check
4. Create test: trace-recorder.test.ts

Output: Trace recorder utility with tests
```

---

## Agent 4.2: Integrate Trace into Drilldown

```
subagent_type: "llm-application-dev:ai-engineer"

Task: Update drilldown function to use TraceRecorder.

Modify: packages/core/src/review/drilldown.ts

Changes:
1. Create TraceRecorder at start
2. Wrap all tool calls
3. Include trace in result

Example:

import { TraceRecorder, summarizers } from './trace-recorder';

export async function drilldownIssue(
  client: AIClient,
  issue: TriageIssue,
  diff: string,
  allIssues: TriageIssue[],
  options?: DrilldownOptions
): Promise<Result<DrilldownResult, DrilldownError>> {
  const recorder = new TraceRecorder();

  try {
    // Step 1: Read file context
    const fileContext = await recorder.wrap(
      'readFileRange',
      `${issue.location?.file}:${issue.location?.lineStart}-${issue.location?.lineEnd}`,
      async () => {
        if (!issue.location?.file) return '';
        const content = await readFile(issue.location.file);
        // Extract relevant range with buffer
        const start = Math.max(0, (issue.location.lineStart ?? 0) - 20);
        const end = (issue.location.lineEnd ?? issue.location.lineStart ?? 0) + 20;
        const lines = content.split('\n').slice(start, end);
        return lines.join('\n');
      },
      summarizers.fileContent
    );

    // Step 2: Search for related code (optional)
    let relatedCode = '';
    if (issue.category === 'security' || issue.category === 'correctness') {
      relatedCode = await recorder.wrap(
        'searchRepo',
        `"${extractKeyword(issue)}"`,
        async () => {
          // Search for related patterns
          const results = await searchInRepo(extractKeyword(issue));
          return results.map(r => r.content).join('\n');
        },
        (r) => `${r.split('\n').length} related lines`
      );
    }

    // Step 3: Get related issues context
    const relatedIssues = allIssues
      .filter(i => i.id !== issue.id && i.location?.file === issue.location?.file)
      .slice(0, 3);

    recorder.record(
      'getRelatedIssues',
      `issues in ${issue.location?.file}`,
      `${relatedIssues.length} related issues`
    );

    // Step 4: Generate analysis
    const analysis = await recorder.wrap(
      'generateAnalysis',
      'deep issue analysis',
      async () => {
        const prompt = buildDrilldownPrompt({
          issue,
          fileContext,
          relatedCode,
          relatedIssues,
          diff,
        });

        return client.generate(prompt, DrilldownResponseSchema);
      },
      summarizers.analysis
    );

    if (!analysis.ok) {
      return err({ code: 'AI_ERROR', message: analysis.error.message });
    }

    // Build result with trace
    const result: DrilldownResult = {
      issueId: issue.id,
      analysis: analysis.value.analysis,
      rootCause: analysis.value.rootCause,
      impact: analysis.value.impact,
      patch: analysis.value.patch,
      relatedIssues: relatedIssues.map(i => i.id),
      trace: recorder.getTrace(),
      totalDurationMs: recorder.getTotalDuration(),
    };

    return ok(result);
  } catch (error) {
    return err({
      code: 'DRILLDOWN_ERROR',
      message: error instanceof Error ? error.message : String(error),
      trace: recorder.getTrace(),
    });
  }
}

function extractKeyword(issue: TriageIssue): string {
  // Extract searchable keyword from issue title/description
  const words = issue.title.split(' ');
  return words.find(w => w.length > 4) ?? issue.title.slice(0, 20);
}

Update DrilldownResult schema if needed:
- Add trace: TraceRef[]
- Add totalDurationMs: number

Steps:
1. Read existing drilldown.ts
2. Add TraceRecorder usage
3. Update return type
4. Update schema if needed
5. Run: npm run type-check && npx vitest run

Output: Drilldown with trace recording
```

---

## Agent 4.3: Trace View Component

```
subagent_type: "react-component-architect"

Task: Create component to display trace timeline.

Create: apps/cli/src/features/review/components/issue-body-trace.tsx

Implementation:

import { Box, Text } from 'ink';
import type { TraceRef } from '@repo/schemas';

interface IssueBodyTraceProps {
  trace: TraceRef[] | undefined;
  scrollOffset: number;
  height: number;
}

export function IssueBodyTrace({
  trace,
  scrollOffset,
  height,
}: IssueBodyTraceProps) {
  if (!trace || trace.length === 0) {
    return (
      <Box flexDirection="column" paddingY={1}>
        <Text dimColor>No trace available.</Text>
        <Text dimColor>Trigger drilldown (press 'o') to see AI steps.</Text>
      </Box>
    );
  }

  // Calculate visible range
  const itemsPerStep = 3; // lines per trace step
  const visibleSteps = Math.floor(height / itemsPerStep);
  const visibleTrace = trace.slice(scrollOffset, scrollOffset + visibleSteps);

  return (
    <Box flexDirection="column">
      {/* Header */}
      <Box marginBottom={1}>
        <Text bold>Trace ({trace.length} steps)</Text>
        <Text dimColor> - Total: {formatDuration(sumDurations(trace))}</Text>
      </Box>

      {/* Steps */}
      {visibleTrace.map((step, i) => (
        <Box key={step.step} flexDirection="column" marginBottom={1}>
          {/* Step header */}
          <Box>
            <Text bold color="cyan">{step.step}. </Text>
            <Text bold>{step.tool}</Text>
            <Text dimColor> {formatDuration(step.durationMs)}</Text>
          </Box>

          {/* Input */}
          <Box marginLeft={3}>
            <Text dimColor>{truncate(step.inputSummary, 40)}</Text>
          </Box>

          {/* Output */}
          <Box marginLeft={3}>
            <Text color="green">&gt; </Text>
            <Text>{step.outputSummary}</Text>
          </Box>
        </Box>
      ))}

      {/* Scroll indicator */}
      {trace.length > visibleSteps && (
        <Box>
          <Text dimColor>
            Steps {scrollOffset + 1}-{Math.min(scrollOffset + visibleSteps, trace.length)} of {trace.length}
          </Text>
        </Box>
      )}
    </Box>
  );
}

function formatDuration(ms: number | undefined): string {
  if (ms === undefined) return '';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function sumDurations(trace: TraceRef[]): number {
  return trace.reduce((sum, step) => sum + (step.durationMs ?? 0), 0);
}

function truncate(str: string, len: number): string {
  return str.length > len ? str.slice(0, len - 1) + '…' : str;
}

Update: apps/cli/src/features/review/components/index.ts
- Export IssueBodyTrace

Steps:
1. Create issue-body-trace.tsx
2. Export from index.ts
3. Run: npm run type-check

Output: Trace view component
```

---

## Agent 4.4: Update Drilldown API Response

```
subagent_type: "backend-development:backend-architect"

Task: Ensure server returns trace in drilldown response.

Modify: apps/server/src/api/routes/triage.ts

In the drilldown endpoint, ensure the response includes trace:

// POST /triage/reviews/:id/drilldown
app.post('/triage/reviews/:id/drilldown', async (c) => {
  const { id } = c.req.param();
  const { issueId } = await c.req.json();

  const reviewResult = await getTriageReview(id);
  if (!reviewResult.ok) {
    return c.json({ error: 'Review not found' }, 404);
  }

  const issue = reviewResult.value.result.issues.find(i => i.id === issueId);
  if (!issue) {
    return c.json({ error: 'Issue not found' }, 404);
  }

  const drilldownResult = await drilldownIssue(
    client,
    issue,
    reviewResult.value.diff,
    reviewResult.value.result.issues
  );

  if (!drilldownResult.ok) {
    return c.json({
      error: drilldownResult.error.message,
      trace: drilldownResult.error.trace // Include trace even on error
    }, 500);
  }

  // Save drilldown to review
  await addDrilldownToReview(id, drilldownResult.value);

  return c.json({
    drilldown: drilldownResult.value,
    // Trace is included in drilldownResult.value.trace
  });
});

Steps:
1. Read existing triage routes
2. Verify trace is included in response
3. Run: npm run type-check

Output: Server returns trace in drilldown
```

---

## Validation Checklist

After completing all agents:

- [ ] `npm run type-check` passes
- [ ] `npx vitest run packages/core/src/review/trace-recorder.test.ts` passes
- [ ] Drilldown returns trace array
- [ ] Trace tab shows step timeline
- [ ] Duration displayed correctly
- [ ] Scrolling works for long traces

### Manual Test

1. Run review with some issues
2. Select an issue
3. Press 'o' to trigger drilldown
4. Press 't' to view trace tab
5. Verify trace shows:
   - Numbered steps
   - Tool names (readFileRange, searchRepo, generateAnalysis)
   - Input summaries
   - Output summaries
   - Durations
