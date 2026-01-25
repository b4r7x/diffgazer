# Agentic Workflow - Master Orchestrator

## Overview

This orchestrator transforms Stargazer into a **visible agentic system**. It is **self-contained** for empty AI context execution.

---

## Project Context

### What is Stargazer
Local-only CLI tool for AI-powered code review. Server binds to `127.0.0.1` only.

### Tech Stack
- TypeScript, React 19 (Ink for CLI), Chalk, Hono (server), Zod, Vitest
- Vercel AI SDK for multi-provider support

### Monorepo Structure
```
packages/
├── core/       # Business logic, Result type, utilities
├── schemas/    # Zod schemas (canonical types) - LEAF PACKAGE
├── api/        # API client - LEAF PACKAGE
apps/
├── server/     # Hono backend (localhost only)
├── cli/        # React Ink CLI (primary interface)
```

### Key Patterns (DO NOT REMOVE)
1. **Result<T, E>** - Use for errors, not exceptions
2. **Provider Abstraction** - AI providers are swappable
3. **CORS Localhost Only** - Security (CVE-2024-28224)
4. **XML Escaping** - Prompts (CVE-2025-53773)
5. **Zod responseSchema** - For AI JSON output
6. **No Manual Memoization** - React 19 Compiler handles it

### Architecture Rules
- Import flow: apps -> packages, packages/core -> schemas
- ALL files use kebab-case naming
- Features CANNOT import from other features
- Tests co-located with source files

---

## What We're Building

### The Agentic Vision

Transform from:
```
User runs review → [hidden AI work] → Issues appear
```

To:
```
User runs review → See agents start → See tool calls →
See issues found live → Can focus/refine → Issues finalized
```

### Phase Summary

| Phase | Deliverable | Key Insight |
|-------|-------------|-------------|
| 1 | AgentEvent schema | Foundation for visibility |
| 2 | SSE stream events | Real-time agent activity |
| 3 | AgentActivityPanel | User sees agents working |
| 4 | Parallel orchestration | Lenses as named agents |
| 5 | Feedback loop | User controls agents |
| 6 | Proactive drilldown | Agent asks user |
| 7 | Code simplifier | Remove over-engineering |

---

## PHASE 1: Agent Event Schema (CRITICAL)

### Agent 1.1: Create AgentEvent Types
```
subagent_type: "backend-development:backend-architect"

Task: Add agent event types to schemas package.

Location: packages/schemas/src/agent-event.ts

Create these types:

// Agent identity (lens becomes a named agent)
type AgentId = "detective" | "guardian" | "optimizer" | "simplifier" | "tester";

// Map lens to agent
const LENS_TO_AGENT: Record<LensId, AgentId> = {
  correctness: "detective",
  security: "guardian",
  performance: "optimizer",
  simplicity: "simplifier",
  tests: "tester",
};

// Agent metadata
interface AgentMeta {
  id: AgentId;
  lens: LensId;
  name: string;        // "Detective", "Guardian", etc.
  emoji: string;       // "🔍", "🔒", etc.
  description: string; // "Finds bugs and logic errors"
}

// Stream events for visibility
type AgentStreamEvent =
  | { type: "agent_start"; agent: AgentMeta; timestamp: string }
  | { type: "agent_thinking"; agent: AgentId; thought: string; timestamp: string }
  | { type: "tool_call"; agent: AgentId; tool: string; input: string; timestamp: string }
  | { type: "tool_result"; agent: AgentId; tool: string; summary: string; timestamp: string }
  | { type: "issue_found"; agent: AgentId; issue: TriageIssue; timestamp: string }
  | { type: "agent_complete"; agent: AgentId; issueCount: number; timestamp: string }
  | { type: "orchestrator_complete"; summary: string; totalIssues: number; timestamp: string };

// Aggregated agent state for UI
interface AgentState {
  id: AgentId;
  meta: AgentMeta;
  status: "queued" | "running" | "complete";
  progress: number;        // 0-100
  issueCount: number;
  currentAction?: string;  // "Reading auth.ts:42-55"
  lastToolCall?: string;
}

Create Zod schemas for all types.
Export from packages/schemas/src/index.ts.

Steps:
1. Create agent-event.ts
2. Define all types with Zod schemas
3. Export LENS_TO_AGENT mapping
4. Export AGENT_METADATA constant with all agent info
5. Run: npm run type-check

Output: Agent event schema created
```

Wait for Phase 1 to complete.

---

## PHASE 2: Agent Stream Events (CRITICAL)

### Agent 2.1: Emit Agent Events from Triage
```
subagent_type: "llm-application-dev:ai-engineer"

Task: Update triage to emit agent stream events.

Modify: packages/core/src/review/triage.ts

Current signature:
triageReview(options: TriageOptions): Promise<Result<TriageResult, TriageError>>

Add streaming variant:
triageReviewStream(
  options: TriageOptions,
  onEvent: (event: AgentStreamEvent) => void
): Promise<Result<TriageResult, TriageError>>

Emit events at these points:

1. When starting a lens:
   onEvent({ type: "agent_start", agent: AGENT_METADATA[agentId], timestamp: now() })

2. Before AI call:
   onEvent({ type: "agent_thinking", agent: agentId, thought: "Analyzing diff for security issues...", timestamp: now() })

3. When reading file context (if drilldown):
   onEvent({ type: "tool_call", agent: agentId, tool: "readFile", input: "src/auth.ts:42-55", timestamp: now() })

4. When tool completes:
   onEvent({ type: "tool_result", agent: agentId, tool: "readFile", summary: "26 lines read", timestamp: now() })

5. When issue found:
   onEvent({ type: "issue_found", agent: agentId, issue, timestamp: now() })

6. When lens completes:
   onEvent({ type: "agent_complete", agent: agentId, issueCount: issues.length, timestamp: now() })

7. When all done:
   onEvent({ type: "orchestrator_complete", summary, totalIssues, timestamp: now() })

Keep existing triageReview() working (calls triageReviewStream with no-op callback).

Steps:
1. Import AgentStreamEvent from schemas
2. Add triageReviewStream function
3. Emit events at correct points
4. Run: npm run type-check && npx vitest run

Output: Triage emits agent events
```

### Agent 2.2: Update SSE Route to Stream Agent Events
```
subagent_type: "backend-development:backend-architect"

Task: Update triage SSE endpoint to emit agent events.

Modify: apps/server/src/api/routes/triage.ts

Current: Emits lens_start, lens_complete, complete, error

New: Also emit all AgentStreamEvent types

The SSE format:
event: agent_start
data: {"type":"agent_start","agent":{...},"timestamp":"..."}

event: tool_call
data: {"type":"tool_call","agent":"guardian","tool":"readFile","input":"...","timestamp":"..."}

event: issue_found
data: {"type":"issue_found","agent":"guardian","issue":{...},"timestamp":"..."}

Use triageReviewStream and forward all events to SSE.

Steps:
1. Import new types
2. Replace triageReview with triageReviewStream
3. Forward AgentStreamEvent to SSE
4. Run: npm run type-check

Output: SSE emits agent events
```

Phases 2 and 3 can run in parallel.

---

## PHASE 3: Agent Activity Panel (CRITICAL)

### Agent 3.1: Agent Activity State Hook
```
subagent_type: "react-component-architect"

Task: Create hook to manage agent activity state from SSE events.

Location: apps/cli/src/features/review/hooks/use-agent-activity.ts

Hook interface:
const {
  agents,           // AgentState[]
  currentAction,    // string | null (latest tool call description)
  isRunning,        // boolean
  progress,         // number 0-100 (overall)
} = useAgentActivity(events: AgentStreamEvent[])

State management:
- Initialize all agents as "queued"
- On agent_start: set status = "running"
- On tool_call: update currentAction
- On tool_result: clear currentAction or update summary
- On issue_found: increment issueCount
- On agent_complete: set status = "complete"
- Calculate overall progress from agent statuses

Steps:
1. Create use-agent-activity.ts
2. Implement state management
3. Export from features/review/hooks/index.ts
4. Run: npm run type-check

Output: Agent activity hook created
```

### Agent 3.2: Agent Activity Panel Component
```
subagent_type: "react-component-architect"

Task: Create UI component showing agent activity.

Location: apps/cli/src/features/review/components/agent-activity-panel.tsx

Component:
<AgentActivityPanel
  agents={AgentState[]}
  currentAction={string | null}
  height={number}
/>

Layout:
┌─────────────────────┐
│ Agent Activity      │
├─────────────────────┤
│ ✓ 🔍 Detective  (3) │  <- complete, 3 issues
│ ⟳ 🔒 Guardian       │  <- running
│   └─ Reading auth.ts│  <- current action
│ ○ ⚡ Optimizer       │  <- queued
│ ○ 🧹 Simplifier     │
└─────────────────────┘

Visual states:
- Queued: ○ dimmed
- Running: ⟳ bright, show current action indented
- Complete: ✓ with issue count

Use chalk for colors:
- Queued: dim
- Running: cyan
- Complete: green
- Issue count: yellow if > 0

Steps:
1. Create agent-activity-panel.tsx
2. Use Box, Text from ink
3. Handle all agent states
4. Export from components/index.ts
5. Run: npm run type-check

Output: Agent activity panel created
```

### Agent 3.3: Integrate Panel into Review Screen
```
subagent_type: "react-component-architect"

Task: Add agent activity panel to review split-screen.

Modify: apps/cli/src/features/review/components/review-split-screen.tsx

New layout (3 columns when reviewing, 2 when done):

During review:
┌──────────────┬─────────────┬─────────────────────────────┐
│Agent Activity│ Issues (40%)│ Details (remaining)         │
│   (fixed)    │             │                             │
└──────────────┴─────────────┴─────────────────────────────┘

After review complete:
┌─────────────────────┬───────────────────────────────────┐
│ Issues (40%)        │ Details (60%)                     │
└─────────────────────┴───────────────────────────────────┘

Props addition:
interface ReviewSplitScreenProps {
  // existing props...
  agentEvents?: AgentStreamEvent[];
  isReviewing?: boolean;
}

Conditional rendering:
- Show AgentActivityPanel only while isReviewing
- Collapse to 2-column when done

Steps:
1. Import AgentActivityPanel and useAgentActivity
2. Add conditional rendering
3. Adjust column widths
4. Run: npm run type-check

Output: Agent panel integrated
```

Wait for Phases 2 and 3 to complete.

---

## PHASE 4: Parallel Agent Orchestration (HIGH)

### Agent 4.1: Parallel Lens Execution
```
subagent_type: "llm-application-dev:ai-engineer"

Task: Run lenses in parallel with interleaved event emission.

Modify: packages/core/src/review/triage.ts

Current: Lenses run sequentially in for loop

New: Run with Promise.all, interleave events

Implementation approach:
1. Create promise for each lens
2. Each lens emits its own events (agent_start, tool_call, etc.)
3. Events naturally interleave due to async
4. Aggregate results after all complete
5. Deduplicate as before

Key change in triageReviewStream:
const lensPromises = selectedLenses.map(async (lens) => {
  const agentId = LENS_TO_AGENT[lens];
  onEvent({ type: "agent_start", agent: AGENT_METADATA[agentId], timestamp: now() });

  // ... run lens analysis ...

  onEvent({ type: "agent_complete", agent: agentId, issueCount: issues.length, timestamp: now() });
  return issues;
});

const allIssueArrays = await Promise.all(lensPromises);
const allIssues = allIssueArrays.flat();
const deduped = mergeIssues(allIssues);

Benefits:
- Faster (parallel vs sequential)
- More "agentic" feel (multiple agents working)
- Events interleave naturally

Steps:
1. Refactor loop to Promise.all
2. Ensure event ordering is still sensible
3. Test with multiple lenses
4. Run: npm run type-check && npx vitest run

Output: Parallel lens execution
```

### Agent 4.2: Progress Tracking
```
subagent_type: "react-component-architect"

Task: Calculate and display overall progress.

Modify: apps/cli/src/features/review/hooks/use-agent-activity.ts

Add progress calculation:
- Each agent contributes equally (100 / agentCount)
- Queued = 0%
- Running = 50% of its share (working on it)
- Complete = 100% of its share

Example with 4 agents:
- 2 complete, 1 running, 1 queued
- Progress = (25 + 25) + (12.5) + (0) = 62.5%

Also track:
- estimatedTimeRemaining (optional, based on elapsed)
- totalIssuesFound (sum of all agents)

Update AgentActivityPanel to show:
- Overall progress bar
- "3 of 4 agents complete"
- Total issues found so far

Steps:
1. Add progress calculation to hook
2. Update panel to show progress
3. Run: npm run type-check

Output: Progress tracking implemented
```

---

## PHASE 5: User Feedback Loop (HIGH)

### Agent 5.1: Feedback Command Schema
```
subagent_type: "backend-development:backend-architect"

Task: Define feedback command types.

Location: packages/schemas/src/feedback.ts

Types:
type FeedbackCommand =
  | { type: "focus"; filter: string }      // "focus on security"
  | { type: "ignore"; pattern: string }    // "ignore style issues"
  | { type: "refine"; issueId: string }    // re-analyze specific issue
  | { type: "ask"; question: string }      // ask about an issue
  | { type: "stop" };                      // stop current analysis

Create Zod schemas.
Export from index.ts.

Steps:
1. Create feedback.ts
2. Define schemas
3. Export
4. Run: npm run type-check

Output: Feedback schema created
```

### Agent 5.2: Feedback Command Input
```
subagent_type: "react-component-architect"

Task: Add command input for feedback during review.

Location: apps/cli/src/features/review/components/feedback-input.tsx

Component:
<FeedbackInput
  isVisible={boolean}
  onCommand={(cmd: FeedbackCommand) => void}
  onCancel={() => void}
/>

Trigger: User presses `/` or `:`

UI:
┌─────────────────────────────────────────────────────────────┐
│ > focus security_                                           │
│   Commands: focus <topic>, ignore <pattern>, ask <question> │
└─────────────────────────────────────────────────────────────┘

Parse input:
- "focus security" → { type: "focus", filter: "security" }
- "ignore style" → { type: "ignore", pattern: "style" }
- "ask why is this bad" → { type: "ask", question: "why is this bad" }
- Empty enter → onCancel

Use ink-text-input or similar.

Steps:
1. Create feedback-input.tsx
2. Parse command syntax
3. Validate against schema
4. Export from index.ts
5. Run: npm run type-check

Output: Feedback input created
```

### Agent 5.3: Apply Feedback to Review
```
subagent_type: "llm-application-dev:ai-engineer"

Task: Handle feedback commands in review flow.

Modify: apps/cli/src/app/views/review-view.tsx

Add state:
- feedbackMode: boolean
- activeFilter: string | null

Handle commands:
1. focus: Set filter, re-sort/filter issue list
2. ignore: Add to ignore patterns, hide matching issues
3. refine: Trigger drilldown on specific issue
4. ask: Show answer in details pane (uses AI)
5. stop: Cancel running analysis

For "ask" command:
- Send question + issue context to AI
- Display answer in explain tab or overlay

Steps:
1. Add feedback state
2. Implement command handlers
3. Wire to FeedbackInput
4. Run: npm run type-check

Output: Feedback commands working
```

### Agent 5.4: Update Footer with Feedback Shortcuts
```
subagent_type: "react-component-architect"

Task: Update footer to show feedback shortcuts.

Modify: apps/cli/src/components/ui/footer-bar.tsx

Add to shortcuts (key mode):
- `/` or `:` - Open command input
- `f` - Quick focus (shows filter input)
- `Esc` - Cancel command input

Show in footer:
"j/k move  e explain  / command  f focus  ? help"

Steps:
1. Update footer shortcuts
2. Handle key mode vs menu mode
3. Run: npm run type-check

Output: Footer updated
```

---

## PHASE 6: Proactive Drilldown (MEDIUM)

### Agent 6.1: Drilldown Suggestion Logic
```
subagent_type: "llm-application-dev:ai-engineer"

Task: Add logic to suggest drilldown for important issues.

Location: packages/core/src/review/drilldown-suggester.ts

Function:
shouldSuggestDrilldown(issue: TriageIssue): boolean

Criteria:
- Severity is "blocker" or "high"
- Confidence < 0.8 (uncertain, needs more context)
- Category is "security" (always worth deeper look)
- Issue mentions "might", "possibly", "unclear" in rationale

Returns true if any criteria met.

Also:
getSuggestionReason(issue: TriageIssue): string
// "This HIGH severity issue has low confidence. Want me to analyze deeper?"

Steps:
1. Create drilldown-suggester.ts
2. Implement criteria
3. Export from review/index.ts
4. Run: npm run type-check

Output: Drilldown suggestion logic created
```

### Agent 6.2: Drilldown Prompt UI
```
subagent_type: "react-component-architect"

Task: Show prompt when agent suggests drilldown.

Location: apps/cli/src/features/review/components/drilldown-prompt.tsx

Component:
<DrilldownPrompt
  issue={TriageIssue}
  reason={string}
  onAccept={() => void}
  onSkip={() => void}
  onAcceptAll={() => void}
/>

Layout:
┌─────────────────────────────────────────────────────────────┐
│ 🤖 Agent Notice                                             │
├─────────────────────────────────────────────────────────────┤
│ I found a HIGH severity issue that needs more context.      │
│ "SQL Injection Risk in auth.ts"                             │
│                                                             │
│ [y] Analyze deeper  [n] Skip  [a] Analyze all HIGH          │
└─────────────────────────────────────────────────────────────┘

Show after triage completes, before user starts navigating.

Steps:
1. Create drilldown-prompt.tsx
2. Handle keyboard input
3. Export from index.ts
4. Run: npm run type-check

Output: Drilldown prompt created
```

### Agent 6.3: Wire Proactive Drilldown
```
subagent_type: "react-component-architect"

Task: Integrate drilldown suggestion into review flow.

Modify: apps/cli/src/app/views/review-view.tsx

Flow:
1. Triage completes
2. Check each issue with shouldSuggestDrilldown
3. If any, show DrilldownPrompt for first one
4. On accept: run drilldown, update issue, check next
5. On skip: check next
6. On accept all: queue all for drilldown
7. When no more suggestions: show normal review UI

State additions:
- pendingDrilldowns: string[] (issue IDs)
- showingDrilldownPrompt: boolean

Steps:
1. Add suggestion logic after triage
2. Show prompts sequentially
3. Handle user responses
4. Run: npm run type-check

Output: Proactive drilldown wired
```

---

## PHASE 7: Code Simplifier (REQUIRED)

### Agent 7.1: Review All New Code
```
subagent_type: "code-simplifier:code-simplifier"

Task: Review all code created in Phases 1-6 for over-engineering.

Check these files:
- packages/schemas/src/agent-event.ts
- packages/schemas/src/feedback.ts
- packages/core/src/review/triage.ts (new streaming code)
- packages/core/src/review/drilldown-suggester.ts
- apps/cli/src/features/review/hooks/use-agent-activity.ts
- apps/cli/src/features/review/components/agent-activity-panel.tsx
- apps/cli/src/features/review/components/feedback-input.tsx
- apps/cli/src/features/review/components/drilldown-prompt.tsx

Simplification criteria:

1. Remove abstractions with single use
   - Interface with one implementation → inline type
   - Factory creating one thing → direct construction
   - Generic <T> used with one type → concrete type

2. Remove unused code
   - Exported but never imported
   - Parameters always passed same value
   - Branches never executed

3. Flatten unnecessary nesting
   - Extract early returns
   - Remove wrapper functions that just call another function

4. Simplify state
   - Derived state that can be computed → compute it
   - State that's always same value → constant

5. Remove defensive code for impossible cases
   - Null checks after Zod validation
   - Type guards when TypeScript already knows

Apply fixes directly. Run tests after each file.

Steps:
1. Read each file
2. Identify simplifications
3. Apply changes
4. Run: npm run type-check && npx vitest run
5. Repeat until clean

Output: All code simplified
```

### Agent 7.2: Final Validation
```
subagent_type: "code-reviewer"

Task: Final validation of all changes.

Checks:
1. Type check passes: npm run type-check
2. All tests pass: npx vitest run
3. No new lint warnings
4. No console.log statements (use proper logging)
5. All exports are used
6. No TODO comments without issue reference

Manual review:
1. AgentActivityPanel renders correctly
2. Events stream in real-time
3. Parallel execution feels responsive
4. Feedback commands work
5. Drilldown prompts appear appropriately

Report any issues found.

Output: Final validation complete
```

---

## Summary

After all phases complete:

1. ✅ Agent events schema defined
2. ✅ SSE streams agent activity
3. ✅ UI shows agents working in real-time
4. ✅ Lenses run in parallel as named agents
5. ✅ User can focus/refine/ask during review
6. ✅ Agent proactively suggests deep analysis
7. ✅ Code is simple and maintainable

The result: A **visible, controllable, agentic** code review system perfect for hackathon demo.
