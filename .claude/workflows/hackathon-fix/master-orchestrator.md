# Hackathon Fix - Master Orchestrator

## Overview

This orchestrator **fixes the critical UI gap** where agent activity is not visible after triage completes. It is **self-contained** for empty AI context execution.

**Problem:** AgentActivityPanel shows during loading but disappears after triage completes, losing the "agentic" feel.

**Goal:** Make completed agent activity visible throughout the review experience.

---

## Project Context

### What is Stargazer
Local-only CLI tool for AI-powered code review. Server binds to `127.0.0.1` only.

### Tech Stack
- TypeScript, React 19 (Ink for CLI), Chalk, Hono (server), Zod, Vitest
- Vercel AI SDK for multi-provider support

### Key Patterns (DO NOT REMOVE)
1. **Result<T, E>** - Use for errors, not exceptions
2. **No Manual Memoization** - React 19 Compiler handles it
3. **CORS Localhost Only** - Security (CVE-2024-28224)

---

## Current State Analysis

### What Exists (DO NOT REBUILD)

**Components that work:**
- `AgentActivityPanel` - Shows agent status with ✓/⟳/○ icons
- `ReviewSplitScreen` - Has `agentEvents` and `isReviewing` props, shows panel
- `useAgentActivity` hook - Converts events to AgentState[]
- `useTriage` hook - Collects `agentEvents` from SSE stream

**The Bug:**
`ReviewView` uses an inline `ReviewSplitScreenView` function instead of the proper `ReviewSplitScreen` component. This inline version:
- Shows `AgentActivityPanel` during loading (good)
- Hides it completely after success (bad)
- Never passes `agentEvents` to the success view

### File Locations

| File | Problem |
|------|---------|
| `apps/cli/src/app/views/review-view.tsx` | Uses inline view, not proper component |
| `apps/cli/src/features/review/components/review-split-screen.tsx` | Has panel, NOT USED |

---

## Phase Summary

| Phase | Deliverable | Time Est |
|-------|-------------|----------|
| 1 | Replace inline view with proper component | 30 min |
| 2 | Show completed agents in success state | 15 min |
| 3 | Add agent summary badge to header | 15 min |
| 4 | Test and validate | 15 min |

**Total: ~75 minutes**

---

## PHASE 1: Replace Inline View with Proper Component

### Agent 1.1: Refactor ReviewView to Use ReviewSplitScreen

```
subagent_type: "react-component-architect"

Task: Replace inline ReviewSplitScreenView with the proper ReviewSplitScreen component.

Read first:
- apps/cli/src/app/views/review-view.tsx (the main file)
- apps/cli/src/features/review/components/review-split-screen.tsx (the proper component)

Problem:
ReviewView has an inline function `ReviewSplitScreenView` (lines ~181-685) that duplicates
most of ReviewSplitScreen but LACKS the AgentActivityPanel in the success state.

Solution:
1. Remove the inline ReviewSplitScreenView function
2. Import and use the proper ReviewSplitScreen component
3. Pass agentEvents prop to ReviewSplitScreen

Current flow in ReviewView (line ~687):
```tsx
export function ReviewView({ state, staged, reviewId, agentEvents = [] }: ReviewViewProps) {
  // ...
  if (state.status === "success") {
    // Currently uses inline ReviewSplitScreenView
    return <ReviewSplitScreenView ... />
  }
}
```

New flow:
```tsx
import { ReviewSplitScreen } from "../../features/review/components/review-split-screen.js";

export function ReviewView({ state, staged, reviewId, agentEvents = [] }: ReviewViewProps) {
  // ...
  if (state.status === "success") {
    return (
      <ReviewSplitScreen
        issues={triageIssues}
        selectedIssueId={selectedId}
        onSelectIssue={setSelectedId}
        onApplyPatch={handleApply}
        onIgnoreIssue={handleIgnore}
        onDrilldown={handleDrilldown}
        onBack={handleBack}
        drilldownData={drilldownState.data}
        title={`Code Review (${staged ? "Staged" : "Unstaged"})`}
        agentEvents={agentEvents}
        isReviewing={false}  // false = review complete
        showAgentPanel={true}  // IMPORTANT: Show completed agents
      />
    );
  }
}
```

The ReviewSplitScreen component already handles:
- Agent activity panel with `agentEvents` prop
- `isReviewing` and `showAgentPanel` props for controlling visibility
- All keyboard navigation
- Drilldown, ignore, apply patch

Steps:
1. Read both files to understand differences
2. Map inline props to ReviewSplitScreen props
3. Remove inline ReviewSplitScreenView
4. Add import for ReviewSplitScreen
5. Update success render to use ReviewSplitScreen
6. Pass agentEvents and showAgentPanel=true
7. Run: npm run type-check

Output: ReviewView uses proper component with agent panel
```

### Agent 1.2: Ensure LoadingDisplay Still Works

```
subagent_type: "react-component-architect"

Task: Verify LoadingDisplay continues to show agent activity during loading.

Read: apps/cli/src/app/views/review-view.tsx

The LoadingDisplay component (around line 126-159) already shows AgentActivityPanel.
Verify this still works after the refactor.

Current LoadingDisplay:
```tsx
function LoadingDisplay({
  content,
  staged,
  agentEvents = [],
}: {
  content: string;
  staged: boolean;
  agentEvents?: AgentStreamEvent[];
}) {
  const { agents, currentAction } = useAgentActivity(agentEvents);
  const showAgentPanel = agents.length > 0;

  return (
    <Box flexDirection="column">
      <Box flexDirection="row" gap={2}>
        <Box flexDirection="column">
          <Box>
            <Spinner type="dots" />
            <Text> Reviewing {staged ? "staged" : "unstaged"} changes...</Text>
          </Box>
          {content && <Text dimColor>{truncate(content, 200)}</Text>}
        </Box>
        {showAgentPanel && (
          <Box flexShrink={0} width={28}>
            <AgentActivityPanel
              agents={agents}
              currentAction={currentAction}
              height={10}
            />
          </Box>
        )}
      </Box>
    </Box>
  );
}
```

This is CORRECT. Ensure the refactor doesn't break it.

Steps:
1. After Phase 1.1 refactor, test loading state
2. Verify agents appear during review
3. Run: npm run type-check

Output: LoadingDisplay still shows agents
```

---

## PHASE 2: Show Completed Agents in Success State

### Agent 2.1: Update ReviewSplitScreen showAgentPanel Logic

```
subagent_type: "react-component-architect"

Task: Ensure completed agents show in ReviewSplitScreen.

Read: apps/cli/src/features/review/components/review-split-screen.tsx

Current logic (line ~55):
```tsx
const showAgentPanel =
  showAgentPanelProp !== undefined
    ? showAgentPanelProp
    : isReviewing && agents.length > 0;
```

The prop override works correctly. When showAgentPanelProp=true, panel shows.

Verify:
1. When isReviewing=false and showAgentPanel=true, panel still shows
2. Agents show with ✓ complete status
3. Issue counts show for each agent

The AgentActivityPanel already handles completed agents:
- Status "complete" shows ✓ icon in green
- Issue count shows in parentheses

Steps:
1. Verify logic handles showAgentPanel=true override
2. Test completed agent rendering
3. Run: npm run type-check

Output: Completed agents visible in success state
```

### Agent 2.2: Improve Completed Agent Visual Feedback

```
subagent_type: "react-component-architect"

Task: Enhance completed agent display for better visibility.

Modify: apps/cli/src/features/review/components/agent-activity-panel.tsx

Current completed agent display:
```
✓ 🔍 Detective  (3)
```

Enhance to show:
```
✓ 🔍 Detective  3 issues
```

Also add a summary line at bottom:
```
───────────────────
Review complete
5 agents • 12 issues
```

Find the render code and update:
1. Change "(3)" to "3 issues" for clarity
2. Add summary section when all agents complete
3. Use dimmed separator line

Steps:
1. Read current AgentActivityPanel
2. Update completed agent display text
3. Add summary section
4. Run: npm run type-check

Output: Clearer completed agent display
```

---

## PHASE 3: Add Agent Summary to Header

### Agent 3.1: Add Agent Badge to Review Header

```
subagent_type: "react-component-architect"

Task: Show agent summary in review header.

Modify: apps/cli/src/features/review/components/review-split-screen.tsx

Current header (line ~191):
```tsx
<Box marginBottom={1}>
  <Text bold color="cyan">
    {title}
  </Text>
  <Text dimColor> ({issues.length} issues)</Text>
</Box>
```

Add agent info:
```tsx
<Box marginBottom={1}>
  <Text bold color="cyan">
    {title}
  </Text>
  <Text dimColor> • {issues.length} issues</Text>
  {agents.length > 0 && (
    <Text dimColor> • {agents.filter(a => a.status === 'complete').length} agents ✓</Text>
  )}
</Box>
```

This gives instant feedback that agents were involved even if panel is collapsed.

Steps:
1. Access agents from useAgentActivity hook
2. Add agent count to header
3. Run: npm run type-check

Output: Agent count in header
```

---

## PHASE 4: Test and Validate

### Agent 4.1: Run Type Check

```
subagent_type: "unit-testing:test-automator"

Task: Validate all changes compile.

Run:
```bash
npm run type-check
```

Fix any type errors.

Output: Type check passes
```

### Agent 4.2: Manual Testing Flow

```
subagent_type: "unit-testing:test-automator"

Task: Test the full flow manually.

Test steps:
1. Start server: npm run -w apps/server start
2. Start CLI: npm run -w apps/cli start
3. Run review on a repo with changes
4. Observe:
   - [ ] Agents appear during loading with ⟳ status
   - [ ] Tool calls show (e.g., "Reading auth.ts:42-55")
   - [ ] Issues appear as found
   - [ ] After complete, agents show with ✓ status
   - [ ] Agent panel remains visible in success state
   - [ ] Header shows "N agents ✓"
   - [ ] Issue navigation still works

If any fail, report and fix.

Output: Manual test passes
```

---

## Quick Reference

### Files to Modify
1. `apps/cli/src/app/views/review-view.tsx` - Replace inline view
2. `apps/cli/src/features/review/components/review-split-screen.tsx` - Verify panel logic
3. `apps/cli/src/features/review/components/agent-activity-panel.tsx` - Improve display

### Key Props
```typescript
<ReviewSplitScreen
  issues={issues}
  agentEvents={agentEvents}  // CRITICAL: Pass events
  isReviewing={false}        // false = review complete
  showAgentPanel={true}      // CRITICAL: Show completed agents
/>
```

### Commands
```bash
npm run type-check
npm run build
npm run -w apps/cli start
```

---

## Expected Result

Before fix:
```
[Review loading...]        [Review complete]
┌──────────┬─────────┐    ┌─────────┬─────────────┐
│ Agents   │ Loading │    │ Issues  │ Details     │
│ ⟳ Det.   │ ...     │ →  │ [1] SQL │ ...         │
│ ○ Guard. │         │    │ [2] XSS │             │
└──────────┴─────────┘    └─────────┴─────────────┘
                          ❌ No agent visibility!
```

After fix:
```
[Review loading...]        [Review complete]
┌──────────┬─────────┐    ┌────────┬─────────┬─────────────┐
│ Agents   │ Loading │    │ Agents │ Issues  │ Details     │
│ ⟳ Det.   │ ...     │ →  │ ✓ Det. │ [1] SQL │ ...         │
│ ○ Guard. │         │    │ ✓ Grd. │ [2] XSS │             │
└──────────┴─────────┘    └────────┴─────────┴─────────────┘
                          ✅ Agents still visible!
```

This gives users the full "agentic" experience - seeing which agents contributed what.
