# Data Model: Fix Persistent Web Review Regression & Hooks Validation

## Entities

### ReviewStreamState (shared package)

The authoritative state for the review streaming UI. Lives in `useReviewStream` reducer.

| Field | Type | Source |
|-------|------|--------|
| reviewId | `string \| null` | Set by `review_started` SSE event via reducer |
| isStreaming | `boolean` | `true` after START, `false` after COMPLETE/ERROR/RESET |
| steps | `StepState[]` | Populated by `step_*` SSE events |
| agents | `AgentState[]` | Populated by `agent_*` SSE events |
| events | `ReviewEvent[]` | All SSE events accumulated |
| issues | `ReviewIssue[]` | Populated by `issue_found` SSE events |
| fileProgress | `FileProgress` | `{ completed: string[], total: number }` |
| error | `string \| null` | Set by ERROR action |
| startedAt | `Date \| null` | Set by START action |

### ReviewContext (shared query)

Project context snapshot. Independent from streaming state.

| Field | Type | Source |
|-------|------|--------|
| text | `string` | First N lines of project context |
| characterCount | `number` | Total context size |
| markdown | `string` | Full context as markdown |
| dependencyGraph | `object` | Project dependency information |

**Lifecycle constraint**: Should only be fetched AFTER `reviewId` is set AND the context step has completed. Currently fetched eagerly on mount — this is the bug.

### Review Phase (web page-level)

| Phase | Renders | Transition |
|-------|---------|------------|
| `loading-saved` | `LoadingReviewState` | → `streaming` or `results` (from `loadSavedOrFresh`) |
| `streaming` | `ReviewContainer` | → `summary` (from `onComplete`) |
| `summary` | `ReviewSummaryView` | → `results` (from user action) |
| `results` | `ReviewResultsView` | Terminal |

### Review Phase (CLI lifecycle)

| Phase | Renders | Transition |
|-------|---------|------------|
| `idle` | Nothing (waiting for `start()`) | → `checking-config` |
| `checking-config` | Loading message | → `checking-changes` (when config ready) |
| `checking-changes` | Loading message | → `streaming` (when session checked) |
| `streaming` | `ReviewProgressView` | → `completing` (when stream ends) |
| `completing` | `ReviewProgressView` (final state) | → `summary` (after 2300ms delay) |
| `summary` | `ReviewSummaryView` | → `results` (from user action) |
| `results` | `ReviewResultsView` | Terminal |

## State Transitions: Streaming

```
START (isStreaming: true, reviewId: null, all data cleared)
  │
  ├── EVENT(review_started) → reviewId set
  ├── EVENT(step_*) → steps updated
  ├── EVENT(agent_*) → agents updated
  ├── EVENT(enrich_*) → issues/events updated
  │
  ├── COMPLETE (isStreaming: false, all data preserved)
  │   └── Completion guard fires if reviewId !== null && !error
  │
  ├── ERROR (isStreaming: false, error set)
  │   └── Completion guard blocked by !error check
  │
  └── RESET (isStreaming: false, reviewId: null, all data cleared)
      └── Completion guard blocked by reviewId === null
```

## Code Changes Specification

### Change 1: `review-container.tsx` — lifecycle-aware context fetch

**Before**:
```typescript
const { data: contextData } = useReviewContext();
const contextSnapshot = state.isStreaming ? null : contextData ?? null;
```

**After**: Add `enabled` guard based on reviewId and context step completion:
```typescript
const contextStep = state.steps.find(s => s.id === 'context');
const contextStepCompleted = contextStep?.status === 'completed';
const { data: contextData } = useReviewContext({ enabled: contextStepCompleted && !!state.reviewId });
const contextSnapshot = state.isStreaming ? null : contextData ?? null;
```

**Requires**: `useReviewContext` must accept `options?: { enabled?: boolean }` (same pattern as `useOpenRouterModels`).

### Change 2: `review.ts` (hooks) — add `enabled` option to `useReviewContext`

**Before**:
```typescript
export function useReviewContext() {
  const api = useApi();
  return useQuery(reviewQueries.context(api));
}
```

**After**:
```typescript
export function useReviewContext(options?: { enabled?: boolean }) {
  const api = useApi();
  return useQuery({ ...reviewQueries.context(api), ...options });
}
```

### Change 3: `use-review-stream.ts` — add platform-aware rAF batching

Add `requestAnimationFrame` batching for event dispatching in browser environments. In Node.js (CLI/Ink), dispatch synchronously (current behavior).

**Approach**: Use `typeof requestAnimationFrame !== 'undefined'` to detect browser. Queue events and flush on next animation frame.

### Change 4: Invalidate context cache after streaming completes

In `review-container.tsx` or `use-review-lifecycle.ts`, invalidate the review context query after streaming completes so the next fetch gets fresh data:

```typescript
// After completion detected:
queryClient.invalidateQueries({ queryKey: reviewQueries.context(api).queryKey });
```

### Change 5: Remove unused type exports (hooks quality)

Remove `ReviewStreamState` and `ServerState` type exports from `index.ts` barrel.
