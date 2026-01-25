# Review Pipeline Enhancements - Master Orchestrator

## Overview

This orchestrator implements critical improvements to the Stargazer review pipeline. It is **self-contained** for empty AI context execution.

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
├── core/       # Shared business logic, Result type, utilities
├── schemas/    # Zod schemas (canonical types) - LEAF PACKAGE
├── api/        # API client - LEAF PACKAGE
apps/
├── server/     # Hono backend (localhost only)
├── cli/        # React Ink CLI (primary interface)
```

### Key Patterns (DO NOT REMOVE)
1. **Result<T, E>** - Use for errors, not exceptions
2. **Provider Abstraction** - AI providers are swappable
3. **CORS Localhost Only** - Security requirement (CVE-2024-28224)
4. **XML Escaping** - Escape user content in prompts (CVE-2025-53773)
5. **Zod responseSchema** - For AI JSON output
6. **No Manual Memoization** - React 19 Compiler handles it

### Architecture Rules
- Import flow: apps -> packages, packages/core -> schemas
- ALL files use kebab-case naming
- CLI: screens/, features/, components/, hooks/
- Tests co-located with source files
- Features CANNOT import from other features

---

## What We're Building

### Phase 1: Session Event Recording
- JSONL append-only event log per session
- Events: NAVIGATE, OPEN_ISSUE, APPLY_PATCH, IGNORE_ISSUE, etc.
- Hook for automatic recording in app navigation

### Phase 2: Key Mode Navigation
- Vim-style shortcuts: j/k, o, a, i, e, t, n/p
- Global controlsMode toggle (menu vs keys)
- Focus-aware key routing

### Phase 3: Split-Pane Review
- Left panel: issue list (always visible)
- Right panel: issue details (always visible)
- Focus routing between panels
- Virtual scrolling for large lists

### Phase 4: Trace Recording
- Wrap AI tool calls to record input/output
- Generate TraceRef[] for drilldown
- UI to show "what AI did"

### Phase 5: GitHub Actions
- PR review workflow
- Check annotations output
- Inline comments for high-severity issues

---

## Execution Instructions

Run phases sequentially. Some phases can run in parallel where noted.

---

## PHASE 1: Session Event Recording (CRITICAL)

### Agent 1.1: Core Session Events Storage
```
subagent_type: "backend-development:backend-architect"

Task: Implement JSONL session event storage.

Location: packages/core/src/storage/session-events.ts

Functions to implement:

1. createSessionFile(sessionId: string): Result<string, Error>
   - Creates ~/.stargazer/sessions/<sessionId>.jsonl
   - Returns path

2. appendEvent(sessionId: string, event: SessionEvent): Result<void, Error>
   - Appends JSON line to session file
   - Event format: { ts: ISO8601, type: EventType, payload: {...} }

3. loadEvents(sessionId: string): Result<SessionEvent[], Error>
   - Reads JSONL file
   - Parses each line
   - Returns array of events

4. getLatestSession(projectId: string): Result<string | null, Error>
   - Finds most recent session for project

Use existing patterns:
- Result<T, E> from packages/core/src/result.ts
- Path helpers from packages/core/src/storage/paths.ts

SessionEvent type (from packages/schemas/src/session.ts):
- ts: string (ISO 8601)
- type: "NAVIGATE" | "OPEN_ISSUE" | "TOGGLE_VIEW" | "APPLY_PATCH" | "IGNORE_ISSUE" | "FILTER_CHANGED" | "RUN_CREATED" | "RUN_RESUMED" | "SETTINGS_CHANGED"
- payload: Record<string, unknown>

Steps:
1. Read existing session.ts schema
2. Read packages/core/src/storage/ for patterns
3. Create session-events.ts
4. Export from packages/core/src/storage/index.ts
5. Run: npm run type-check

Output: Session events storage implemented
```

### Agent 1.2: Session Recorder Hook
```
subagent_type: "react-component-architect"

Task: Create hook for recording session events in CLI.

Location: apps/cli/src/hooks/use-session-recorder.ts

Hook interface:
const { recordEvent, sessionId } = useSessionRecorder(projectId: string)

recordEvent(type: SessionEventType, payload: Record<string, unknown>): void
- Calls appendEvent from core
- Non-blocking (fire and forget)
- Logs errors but doesn't throw

Auto-record these events:
- When hook mounts: RUN_CREATED (if new) or RUN_RESUMED (if existing)

Export:
- useSessionRecorder hook
- SessionRecorderContext (for nested components)

Steps:
1. Create use-session-recorder.ts
2. Use session-events.ts from core
3. Export from apps/cli/src/hooks/index.ts
4. Run: npm run type-check

Output: Session recorder hook created
```

### Agent 1.3: Integrate Recording into App
```
subagent_type: "react-component-architect"

Task: Wire session recording into app navigation.

Modify: apps/cli/src/app/app.tsx

Changes:
1. Add SessionRecorderProvider at app root
2. Pass projectId (from current directory hash)

Modify: apps/cli/src/features/app/hooks/use-navigation.ts

Changes:
1. Import useSessionRecorder
2. Record NAVIGATE event on view changes
3. Record SETTINGS_CHANGED when settings update

Modify: apps/cli/src/features/review/hooks/use-triage.ts

Changes:
1. Record RUN_CREATED when triage starts
2. Record OPEN_ISSUE when issue selected
3. Record APPLY_PATCH when patch applied
4. Record IGNORE_ISSUE when issue ignored

Steps:
1. Read existing app.tsx and hooks
2. Add provider wrapper
3. Add recording calls
4. Run: npm run type-check

Output: Session recording integrated
```

Wait for Phase 1 to complete before Phase 2.

---

## PHASE 2: Key Mode Navigation (CRITICAL)

### Agent 2.1: Keyboard Mode Hook
```
subagent_type: "react-component-architect"

Task: Create global keyboard mode management.

Location: apps/cli/src/hooks/use-keyboard-mode.ts

Hook interface:
const { mode, isKeyMode, isMenuMode, toggleMode } = useKeyboardMode()

Mode from settings.controlsMode: "menu" | "keys"

Behavior:
- "menu": Arrow keys + Enter navigation (current default)
- "keys": Vim-style single-key actions

Create KeyModeContext to share mode across components.

Steps:
1. Read existing use-settings.ts or use-config.ts
2. Create use-keyboard-mode.ts
3. Create KeyModeProvider
4. Export from apps/cli/src/hooks/index.ts
5. Run: npm run type-check

Output: Keyboard mode hook created
```

### Agent 2.2: Review Keyboard Handler
```
subagent_type: "react-component-architect"

Task: Create keyboard handler for review screen.

Location: apps/cli/src/features/review/hooks/use-review-keyboard.ts

Hook interface:
useReviewKeyboard({
  focus: "list" | "details",
  onNavigate: (direction: "up" | "down") => void,
  onOpen: () => void,
  onApply: () => void,
  onIgnore: () => void,
  onExplain: () => void,
  onTrace: () => void,
  onNextIssue: () => void,
  onPrevIssue: () => void,
  onToggleFocus: () => void,
  onBack: () => void,
})

Key mappings for "keys" mode:

List focus:
- j / ArrowDown: navigate down
- k / ArrowUp: navigate up
- o / Enter: open issue (drilldown)
- a: apply patch
- i: ignore issue
- e: show explain tab
- t: show trace tab
- n: next open issue
- p: prev open issue
- Tab: switch to details focus
- Esc / q: back to menu

Details focus:
- j / ArrowDown: scroll down
- k / ArrowUp: scroll up
- Tab: cycle tabs (details -> explain -> trace -> patch)
- Esc: back to list focus

For "menu" mode:
- ArrowUp/Down: navigate
- Enter: select
- Esc: back

Uses useInput from Ink.

Steps:
1. Read existing review hooks
2. Create use-review-keyboard.ts
3. Handle both modes
4. Export from features/review/hooks/index.ts
5. Run: npm run type-check

Output: Review keyboard handler created
```

### Agent 2.3: Integrate Keyboard into Review
```
subagent_type: "react-component-architect"

Task: Wire keyboard handler into review components.

Modify: apps/cli/src/features/review/components/review-screen.tsx
(or review-split-screen.tsx if exists)

Changes:
1. Import useReviewKeyboard
2. Add state: focus, selectedIssueId, activeTab
3. Wire keyboard callbacks to state changes
4. Pass focus state to child components for styling

Modify: apps/cli/src/components/ui/footer-bar.tsx

Changes:
1. Accept shortcuts prop based on current mode
2. Show different shortcuts for menu vs keys mode
3. Example keys mode: "j/k Move  o Open  a Apply  i Ignore  e Explain"
4. Example menu mode: "Up/Down Move  Enter Select  Esc Back"

Steps:
1. Read existing review components
2. Add keyboard integration
3. Update footer bar
4. Run: npm run type-check

Output: Keyboard integrated into review
```

Phases 2 and 3 can run in parallel.

---

## PHASE 3: Split-Pane Integration (HIGH)

### Agent 3.1: Review Split Screen Component
```
subagent_type: "react-component-architect"

Task: Create split-pane review screen with simultaneous list + details.

Location: apps/cli/src/features/review/components/review-split-screen.tsx

Component:
<ReviewSplitScreen
  issues={TriageIssue[]}
  selectedIssueId={string | null}
  onSelectIssue={(id: string) => void}
  onApplyPatch={(id: string) => void}
  onIgnoreIssue={(id: string) => void}
  onDrilldown={(id: string) => void}
  drilldownData={DrilldownResult | null}
/>

Layout (using SplitPane from components/ui):
┌─────────────────────┬────────────────────────────────┐
│ Issues (40%)        │ Details (60%)                  │
├─────────────────────┼────────────────────────────────┤
│ [filtry]            │ ## Issue Title [HIGH][SECURITY]│
│ 3 issues (1 high)   │ src/auth.ts:42-55              │
├─────────────────────┤                                │
│ > SQL Injection     │ ### Symptom                    │
│   Missing null      │ User input passed directly...  │
│   N+1 query         │                                │
│                     │ ### Why It Matters             │
│                     │ Could lead to data breach...   │
│                     │                                │
│                     │ ### Fix Plan                   │
│                     │ 1. Add input validation        │
│                     │ 2. Use parameterized queries   │
└─────────────────────┴────────────────────────────────┘

State management:
- selectedIssueId: currently highlighted issue
- focus: "list" | "details"
- activeTab: "details" | "explain" | "trace" | "patch"
- listScrollOffset: for virtual scrolling
- detailsScrollOffset: for content scrolling

Use existing components:
- SplitPane from components/ui/split-pane.tsx
- IssueItem from features/review/components/issue-item.tsx
- Badge from components/ui/badge.tsx

Steps:
1. Read existing SplitPane component
2. Read existing issue components
3. Create review-split-screen.tsx
4. Handle focus styling (dim inactive panel)
5. Export from features/review/components/index.ts
6. Run: npm run type-check

Output: Split-pane review screen created
```

### Agent 3.2: Issue List Pane with Virtual Scroll
```
subagent_type: "react-component-architect"

Task: Create issue list pane with virtual scrolling.

Location: apps/cli/src/features/review/components/issue-list-pane.tsx

Component:
<IssueListPane
  issues={TriageIssue[]}
  selectedId={string | null}
  onSelect={(id: string) => void}
  focus={boolean}
  height={number}
/>

Features:
1. Header with counts: "3 issues (1 blocker, 1 high, 1 medium)"
2. Virtual scrolling:
   - Calculate visible rows from height
   - Only render visible slice
   - Auto-scroll to keep selection visible
3. Issue item shows: severity badge, title, file:line
4. Selected item highlighted (inverse/bold when focused)
5. Dimmed when not focused

State:
- scrollOffset: first visible index
- visibleCount: calculated from height

Steps:
1. Read existing issue list components
2. Create issue-list-pane.tsx
3. Implement virtual scrolling logic
4. Export from index.ts
5. Run: npm run type-check

Output: Issue list pane created
```

### Agent 3.3: Issue Details Pane with Tabs
```
subagent_type: "react-component-architect"

Task: Create issue details pane with tabbed content.

Location: apps/cli/src/features/review/components/issue-details-pane.tsx

Component:
<IssueDetailsPane
  issue={TriageIssue | null}
  drilldown={DrilldownResult | null}
  activeTab={"details" | "explain" | "trace" | "patch"}
  onTabChange={(tab) => void}
  focus={boolean}
  height={number}
/>

Layout:
┌─────────────────────────────────────────────┐
│ ## SQL Injection Risk        [HIGH][SECURITY]│
│ src/auth.ts:42-55                            │
├─────────────────────────────────────────────┤
│ [Details] [Explain] [Trace] [Patch]          │
├─────────────────────────────────────────────┤
│ (scrollable content based on active tab)     │
│                                              │
│                                              │
└─────────────────────────────────────────────┘

Tab content components (use existing or create):
- IssueBodyDetails: symptom, whyItMatters, fixPlan, recommendation
- IssueBodyExplain: evidence[] with sources
- IssueBodyTrace: trace[] timeline
- IssueBodyPatch: suggested patch diff + apply button

Empty state when no issue selected:
"Select an issue from the list"

Steps:
1. Read existing detail components
2. Create issue-details-pane.tsx
3. Handle tab navigation
4. Implement content scrolling
5. Export from index.ts
6. Run: npm run type-check

Output: Issue details pane created
```

### Agent 3.4: Integrate Split-Pane into Review View
```
subagent_type: "react-component-architect"

Task: Replace existing review display with split-pane.

Modify: apps/cli/src/app/views/review-view.tsx

Changes:
1. Replace ReviewDisplay with ReviewSplitScreen
2. Add state management for:
   - selectedIssueId
   - focus
   - activeTab
   - drilldownData (fetched on demand)
3. Connect to use-triage hook for issues data
4. Connect to use-review-keyboard for navigation
5. Wire drilldown fetching when user requests

Modify: apps/cli/src/features/review/components/index.ts
- Export new split-pane components

Steps:
1. Read existing review-view.tsx
2. Integrate new components
3. Wire state and keyboard
4. Test navigation
5. Run: npm run type-check

Output: Split-pane integrated
```

Wait for Phases 2 and 3 to complete.

---

## PHASE 4: Trace Recording (HIGH)

### Agent 4.1: Trace Recorder Utility
```
subagent_type: "backend-development:backend-architect"

Task: Create utility to record AI tool calls for trace.

Location: packages/core/src/review/trace-recorder.ts

Interface:
class TraceRecorder {
  constructor()

  wrap<T>(
    toolName: string,
    inputSummary: string,
    fn: () => Promise<T>
  ): Promise<T>
  // Wraps function, records input/output/timing

  getTrace(): TraceRef[]
  // Returns all recorded steps

  clear(): void
  // Resets trace
}

TraceRef structure (from schemas):
{
  step: number,
  tool: string,
  inputSummary: string,
  outputSummary: string,
  timestamp: string (ISO),
  artifacts?: string[]
}

Usage in drilldown:
const recorder = new TraceRecorder()
const fileContent = await recorder.wrap(
  "readFileRange",
  `${path}:${start}-${end}`,
  () => readFileRange(path, start, end)
)

Steps:
1. Read packages/schemas/src/triage.ts for TraceRef
2. Create trace-recorder.ts
3. Export from packages/core/src/review/index.ts
4. Run: npm run type-check

Output: Trace recorder created
```

### Agent 4.2: Integrate Trace into Drilldown
```
subagent_type: "llm-application-dev:ai-engineer"

Task: Update drilldown to use TraceRecorder and return trace.

Modify: packages/core/src/review/drilldown.ts

Changes:
1. Import TraceRecorder
2. Create recorder at start of drilldownIssue()
3. Wrap all tool calls:
   - File reads: recorder.wrap("readFile", path, () => ...)
   - Repo searches: recorder.wrap("searchRepo", query, () => ...)
   - AI calls: recorder.wrap("generateAnalysis", "issue analysis", () => ...)
4. Include trace in DrilldownResult:
   {
     ...existingFields,
     trace: recorder.getTrace()
   }
5. Update DrilldownResult type in schemas if needed

Steps:
1. Read existing drilldown.ts
2. Add TraceRecorder usage
3. Update return type
4. Run: npm run type-check && npx vitest run

Output: Drilldown with trace recording
```

### Agent 4.3: Trace View Component
```
subagent_type: "react-component-architect"

Task: Create component to display trace timeline.

Location: apps/cli/src/features/review/components/issue-body-trace.tsx

Component:
<IssueBodyTrace
  trace={TraceRef[] | undefined}
  height={number}
/>

Display format:
┌─────────────────────────────────────────────┐
│ ## Trace (4 steps)                          │
├─────────────────────────────────────────────┤
│ 1. readFileRange                    00:00.12│
│    src/auth.ts:35-60                        │
│    > 26 lines read                          │
│                                             │
│ 2. searchRepo                       00:00.34│
│    "password validation"                    │
│    > 3 matches found                        │
│                                             │
│ 3. readFileRange                    00:00.08│
│    src/validation.ts:10-40                  │
│    > 31 lines read                          │
│                                             │
│ 4. generateAnalysis                 00:02.15│
│    issue analysis                           │
│    > Analysis complete                      │
└─────────────────────────────────────────────┘

Empty state when no trace:
"No trace available. Trigger drilldown to see AI steps."

Steps:
1. Create issue-body-trace.tsx
2. Format timestamps relative to first step
3. Handle scrolling for long traces
4. Export from index.ts
5. Run: npm run type-check

Output: Trace view component created
```

Wait for Phase 4 to complete.

---

## PHASE 5: GitHub Actions (MEDIUM)

### Agent 5.1: PR Review Endpoint
```
subagent_type: "backend-development:backend-architect"

Task: Create server endpoint for PR diff review.

Location: apps/server/src/api/routes/pr-review.ts

Route:
POST /pr-review
Body: {
  diff: string,           // PR diff content
  lenses?: string[],      // Optional lens selection
  profile?: string,       // Optional profile
  baseRef?: string,       // e.g., "main"
  headRef?: string,       // e.g., "feature/xyz"
}

Response:
{
  summary: string,
  issues: Array<{
    severity: string,
    title: string,
    file: string,
    line: number,
    message: string,
    suggestion?: string,
  }>,
  annotations: Array<{
    path: string,
    start_line: number,
    end_line: number,
    annotation_level: "notice" | "warning" | "failure",
    message: string,
    title: string,
  }>
}

The annotations array is formatted for GitHub Check annotations API.

Steps:
1. Create pr-review.ts
2. Use existing triage logic
3. Transform issues to annotations format
4. Mount route in app.ts
5. Run: npm run type-check

Output: PR review endpoint created
```

### Agent 5.2: GitHub Actions Workflow
```
subagent_type: "backend-development:backend-architect"

Task: Create GitHub Actions workflow for AI review.

Location: .github/workflows/ai-review.yml

Workflow:
name: AI Code Review
on:
  pull_request:
    types: [opened, synchronize]

jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci

      - name: Get PR diff
        run: |
          git diff origin/${{ github.base_ref }}...HEAD > pr.diff

      - name: Build
        run: npm run build

      - name: Run AI Review
        env:
          GEMINI_API_KEY: ${{ secrets.GEMINI_API_KEY }}
        run: |
          # Start server in background
          npm run -w apps/server start &
          sleep 5
          # Call review endpoint
          curl -X POST http://localhost:7860/pr-review \
            -H "Content-Type: application/json" \
            -d @- <<EOF > review.json
          {
            "diff": $(cat pr.diff | jq -Rs .),
            "profile": "strict"
          }
          EOF
          # Extract annotations
          jq '.annotations' review.json > annotations.json

      - name: Post annotations
        uses: yuzutech/annotations-action@v0.5.0
        with:
          repo-token: ${{ secrets.GITHUB_TOKEN }}
          input: annotations.json

Security note:
- Uses pull_request (not pull_request_target)
- No secrets exposed to fork PRs
- For fork PRs, require manual trigger or collaborator check

Steps:
1. Create .github/workflows/ directory if needed
2. Create ai-review.yml
3. Test locally with act if possible

Output: GitHub Actions workflow created
```

### Agent 5.3: CLI PR Review Command
```
subagent_type: "backend-development:backend-architect"

Task: Add CLI command for PR review output.

Location: apps/cli/src/features/review/apps/pr-review-app.tsx

Command: stargazer review --pr --output annotations.json

Features:
1. Read diff from stdin or file
2. Run triage with specified profile
3. Output in GitHub annotations format
4. Non-interactive mode for CI

Also add to main CLI entry point.

Steps:
1. Create pr-review-app.tsx
2. Add CLI argument parsing
3. Output JSON format
4. Run: npm run type-check

Output: CLI PR review command created
```

---

## PHASE 6: Final Validation

### Agent 6.1: Type Check & Tests
```
subagent_type: "code-reviewer"

Task: Validate all changes.

Steps:
1. Run: npm run type-check
2. Run: npx vitest run
3. Fix any failing tests
4. Add tests for:
   - Session events storage (append, load)
   - TraceRecorder (wrap, getTrace)
   - Keyboard mode hook

Output: All tests passing
```

### Agent 6.2: Integration Test
```
subagent_type: "code-reviewer"

Task: Manual integration test.

Test scenarios:
1. Session recording:
   - Start app, navigate, open issues
   - Check ~/.stargazer/sessions/*.jsonl has events

2. Key mode:
   - Enable key mode in settings
   - Test j/k navigation in review
   - Test o/a/i actions
   - Test Tab focus switching

3. Split-pane:
   - Run review with multiple issues
   - Verify list + details visible simultaneously
   - Test scrolling in both panes

4. Trace:
   - Trigger drilldown on issue
   - Verify trace tab shows steps
   - Check timestamps and summaries

Report any issues found.

Output: Integration test report
```

---

## Summary

After all phases complete:

1. Session events recorded to JSONL
2. Vim-style key mode working
3. Split-pane review with simultaneous list + details
4. Trace recording in drilldown
5. GitHub Actions PR review workflow
6. All tests passing
