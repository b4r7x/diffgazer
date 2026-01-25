# Phase 7: Code Simplifier

## Overview

Final cleanup phase. Review all code created in Phases 1-6 and remove over-engineering. Ensure KISS, YAGNI, DRY, SRP are followed.

## Goal

- Remove unnecessary abstractions
- Simplify complex logic
- Delete unused code
- Ensure code is "understandable like for a 5 year old"

---

## Agent 7.1: Review New Schema Files

```
subagent_type: "code-simplifier:code-simplifier"

Task: Review and simplify schema files.

Files to review:
- packages/schemas/src/agent-event.ts
- packages/schemas/src/feedback.ts

## Simplification Checklist

### Check 1: Unnecessary Types

Remove if:
- Type alias that just renames another type
- Interface with single implementation
- Generic used with only one concrete type

Example BAD:
type AgentIdentifier = string; // Just use string

Example GOOD:
type AgentId = "detective" | "guardian" | ...; // Actual constraint

### Check 2: Redundant Validation

Remove if:
- Zod already validates what you're checking
- TypeScript already enforces the constraint

Example BAD:
const AgentIdSchema = z.string().refine(
  (s) => ["detective", "guardian"].includes(s)
);

Example GOOD:
const AgentIdSchema = z.enum(["detective", "guardian", ...]);

### Check 3: Over-Detailed Schemas

Simplify if:
- Schema has fields that are never read
- Schema validates things that don't matter

Example BAD:
z.object({
  timestamp: z.string().datetime().min(20).max(30),
});

Example GOOD:
z.object({
  timestamp: z.string(),
});

### Check 4: Duplicate Constants

Consolidate if:
- Same data defined in multiple places
- Can derive one from the other

## Steps

1. Read each schema file
2. Apply checklist
3. Remove/simplify identified issues
4. Run: npm run type-check && npx vitest run
5. Verify no regressions

Output: Schemas simplified
```

---

## Agent 7.2: Review Core Logic Files

```
subagent_type: "code-simplifier:code-simplifier"

Task: Review and simplify core logic files.

Files to review:
- packages/core/src/review/triage.ts (new streaming code)
- packages/core/src/review/drilldown-suggester.ts

## Simplification Checklist

### Check 1: Unnecessary Abstractions

Remove if:
- Function that just calls another function
- Factory that creates one type
- Wrapper with no additional logic

Example BAD:
function createEvent(type, agent) {
  return makeAgentEvent({ type, agent, timestamp: now() });
}
function makeAgentEvent(data) {
  return { ...data };
}

Example GOOD:
// Inline the creation
onEvent({ type, agent, timestamp: now() });

### Check 2: Premature Optimization

Remove if:
- Caching that doesn't improve performance
- Batching that complicates logic
- Parallelization that adds complexity for <100ms gain

### Check 3: Defensive Code for Impossible Cases

Remove if:
- Null check after Zod validation
- Type guard when TypeScript knows the type
- Error handling for errors that can't happen

Example BAD:
const agent = AGENT_METADATA[agentId];
if (!agent) throw new Error("Unknown agent"); // Can't happen - types guarantee it

Example GOOD:
const agent = AGENT_METADATA[agentId];
// Types guarantee this exists

### Check 4: Dead Code

Remove if:
- Exported but never imported
- Condition that's always true/false
- Parameter that's always same value

## Steps

1. Read each core file
2. Apply checklist
3. Remove/simplify identified issues
4. Run: npm run type-check && npx vitest run
5. Verify no regressions

Output: Core logic simplified
```

---

## Agent 7.3: Review UI Components

```
subagent_type: "code-simplifier:code-simplifier"

Task: Review and simplify UI components.

Files to review:
- apps/cli/src/features/review/hooks/use-agent-activity.ts
- apps/cli/src/features/review/components/agent-activity-panel.tsx
- apps/cli/src/features/review/components/feedback-input.tsx
- apps/cli/src/features/review/components/drilldown-prompt.tsx

## Simplification Checklist

### Check 1: Derived State

Compute if:
- State can be calculated from other state
- useMemo/derived is simpler than syncing

Example BAD:
const [agents, setAgents] = useState([]);
const [runningCount, setRunningCount] = useState(0);
// Must keep in sync

Example GOOD:
const [agents, setAgents] = useState([]);
const runningCount = agents.filter(a => a.status === "running").length;

### Check 2: Unnecessary Memoization

Remove if:
- React 19 Compiler handles it
- Computation is trivial
- Not actually a performance problem

Example BAD:
const symbol = useMemo(() => getSymbol(status), [status]);

Example GOOD:
const symbol = getSymbol(status); // React 19 Compiler handles this

### Check 3: Over-Componentization

Inline if:
- Component used in exactly one place
- Component is <10 lines
- No reuse benefit

Example BAD:
function ProgressBar({ value }) { ... } // Used once, 5 lines
<ProgressBar value={progress} />

Example GOOD:
// Inline in parent
<Text>{"█".repeat(filled)}{"░".repeat(empty)}</Text>

### Check 4: Complex Conditional Rendering

Simplify if:
- Nested ternaries
- Multiple conditions for same outcome
- Can use early return

Example BAD:
{isLoading ? <Spinner /> : error ? <Error /> : data ? <Content /> : null}

Example GOOD:
if (isLoading) return <Spinner />;
if (error) return <Error />;
if (!data) return null;
return <Content />;

### Check 5: Props Drilling

Flatten if:
- Passing 5+ props through multiple levels
- Most props unused at intermediate levels

But don't add Context for 2-3 props - that's over-engineering.

## Steps

1. Read each UI file
2. Apply checklist
3. Remove/simplify identified issues
4. Run: npm run type-check
5. Verify UI still works

Output: UI components simplified
```

---

## Agent 7.4: Final Validation

```
subagent_type: "code-reviewer"

Task: Final validation of all changes.

## Automated Checks

Run these commands:
npm run type-check
npx vitest run

All must pass.

## Manual Checks

### 1. No Debug Code

Search for and remove:
- console.log (use proper logging if needed)
- debugger statements
- TODO without issue reference
- Commented-out code blocks

### 2. All Exports Used

For each export in new files, verify it's imported somewhere:
- AgentIdSchema → used in events
- AGENT_METADATA → used in triage
- FeedbackCommand → used in UI
- etc.

Remove unused exports.

### 3. Consistent Naming

Verify all files follow kebab-case:
- agent-event.ts ✓
- agentEvent.ts ✗

Verify all types follow PascalCase:
- AgentState ✓
- agent_state ✗

### 4. No Circular Dependencies

Run:
npx madge --circular packages/

Fix any cycles found.

### 5. Test Coverage

New functions should have tests:
- shouldSuggestDrilldown → has test?
- parseCommand → has test?
- useAgentActivity → has test?

Add simple tests for untested functions.

## UI Verification

Start the app and verify:

1. Agent activity panel renders
2. Progress bar updates
3. Events stream in real-time
4. Feedback commands work (/focus, /ignore)
5. Drilldown prompts appear appropriately
6. All keyboard shortcuts work

## Report

Create a summary of:
- Files changed
- Lines added/removed
- Any remaining concerns

Output: Final validation complete
```

---

## Simplification Principles

### KISS - Keep It Simple, Stupid

> If a 5-year-old can't understand the flow, simplify it.

Before:
```typescript
const eventEmitter = createEventEmitter<AgentEvent>();
const subscriber = eventEmitter.subscribe(handleEvent);
eventEmitter.emit(event);
```

After:
```typescript
onEvent(event);
```

### YAGNI - You Ain't Gonna Need It

> Don't build for hypothetical future requirements.

Before:
```typescript
interface AgentConfig {
  id: AgentId;
  lens: LensId;
  name: string;
  emoji: string;
  color: string;
  priority: number;
  timeout: number;
  retryCount: number;
  features: string[];
}
```

After:
```typescript
interface AgentMeta {
  id: AgentId;
  lens: LensId;
  name: string;
  emoji: string;
}
```

### DRY - Don't Repeat Yourself

> But don't abstract until you have 3 uses.

Before (too DRY):
```typescript
const withTimestamp = (obj) => ({ ...obj, timestamp: now() });
onEvent(withTimestamp({ type: "start", agent }));
onEvent(withTimestamp({ type: "complete", agent }));
```

After (acceptable repetition):
```typescript
onEvent({ type: "start", agent, timestamp: now() });
onEvent({ type: "complete", agent, timestamp: now() });
```

### SRP - Single Responsibility Principle

> Each function/component does one thing.

Before:
```typescript
function handleAgentAndUpdateUIAndEmitEventAndLogAndCache() { ... }
```

After:
```typescript
function emitAgentEvent(event) { ... }
// UI updates via hook observing events
// Logging is separate middleware
// No caching (YAGNI)
```
