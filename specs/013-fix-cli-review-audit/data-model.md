# Data Model: Fix CLI Review Regression & Quality Audit

**Branch**: `013-fix-cli-review-audit` | **Date**: 2026-03-25

No new entities are introduced. This feature fixes bugs and consolidates existing code.

## Relevant State Machines

### Review Stream State (existing, in `@diffgazer/core/review`)

```
ReviewState:
  isStreaming: boolean
  steps: StepState[]       # 5 steps: diff, context, review, enrich, report
  agents: AgentState[]
  events: ReviewEvent[]
  issues: ReviewIssue[]
  fileProgress: FileProgress
  error: string | null
  startedAt: Date | null

Actions: START | COMPLETE | RESET | ERROR | EVENT
```

### CLI Review Lifecycle Phases (existing, being fixed)

```
idle → checking-config → checking-changes → streaming → completing → summary → results
       ↑                                      |
       └──────── reset() ────────────────────┘
```

**Bug**: When `stream.resume()` dispatches `RESET`, the lifecycle stays in `streaming` phase with no recovery. Fix eliminates `checking-config`/`checking-changes` phases from `useReviewStart` by adopting the web's single-effect pattern.

### Web Review Start (target pattern for CLI)

```
[hasStartedRef = false] → single useEffect fires → checks config → imperative getActiveSession() → start or resume → [hasStartedRef = true]
```

No intermediate states. Recovery is built into the promise chain (`.catch(() => startFresh())`).

## Functions Being Extracted to Shared Packages

### To `@diffgazer/core/format`

```typescript
// Already exists in core/format.ts, adding:
function getProviderStatus(isLoading: boolean, isConfigured: boolean): "active" | "idle"
function getProviderDisplay(provider?: string, model?: string): string
```

### To `@diffgazer/core/review`

```typescript
// Already exists in core/review, adding:
function mapStepStatus(status: StepState["status"]): "pending" | "running" | "complete" | "error"
function getAgentDetail(agent: AgentState): string
```

### To `@diffgazer/schemas/ui`

```typescript
// Already exists in schemas/ui, adding:
const TAG_BADGE_VARIANTS: Record<string, BadgeVariant>
// Maps: system → "default", agent → "info", tool → "warning", error → "destructive"
```
