# Data Model: Fix Review Regression & Consolidate Shared Review Hooks

## Entities

### ReviewStreamState (existing, modified)

The state managed by `useReviewStream` via `useReducer`. No structural changes, but the `resume` method's return type changes.

**Fields**: `steps`, `agents`, `events`, `issues`, `isStreaming`, `error`, `startedAt`, `reviewId`

**State transitions**:
- `START` -> sets `isStreaming: true`, clears error
- `STEP_UPDATE` / `AGENT_UPDATE` / `ISSUE` / `EVENT` -> incremental updates during streaming
- `SET_REVIEW_ID` -> assigns `reviewId` from first server event
- `COMPLETE` -> sets `isStreaming: false`
- `ERROR` -> sets `isStreaming: false`, `error: message`
- `RESET` -> returns to initial state (kept for internal use, but no longer dispatched for stale/not-found)

**Change**: `resume()` return type from `Promise<void>` to `Promise<Result<void, StreamReviewError>>`. For `SESSION_STALE` and `SESSION_NOT_FOUND`, the hook returns the error Result WITHOUT dispatching `RESET` or `ERROR`. For other errors, dispatches `ERROR` AND returns the Result.

### UseReviewStartOptions (new, shared)

Options interface for the consolidated `useReviewStart` hook.

**Fields**:
- `mode: ReviewMode` -- "staged" | "unstaged" | "files"
- `configLoading: boolean` -- whether config query is still loading
- `settingsLoading: boolean` -- whether settings query is still loading
- `isConfigured: boolean` -- whether the app is fully configured
- `defaultLenses: LensId[]` -- resolved analysis lenses from settings
- `reviewId?: string` -- optional URL-based review ID (web passes it, CLI omits)
- `start: (options: { mode?: ReviewMode; lenses?: LensId[] }) => Promise<void>` -- stream start function
- `resume: (id: string) => Promise<Result<void, StreamReviewError>>` -- stream resume function (now returns Result)
- `getActiveSession: (mode: ReviewMode) => Promise<{ session: { reviewId: string } | null }>` -- active session check

**Validation**: `mode` must be a valid `ReviewMode`. `defaultLenses` must be an array of valid `LensId` values (validated by `resolveDefaultLenses` in core).

### UseReviewStartResult (new, shared)

**Fields**:
- `startReview: () => void` -- imperative function to trigger the review start (replaces effect-based auto-start)
- `hasStarted: boolean` -- whether the start flow has been initiated (state, not ref)
- `hasStreamed: boolean` -- whether streaming has begun (state, not ref)

### UseReviewCompletionOptions (new, shared)

Options interface for the consolidated `useReviewCompletion` hook.

**Fields**:
- `isStreaming: boolean` -- current streaming state
- `error: string | null` -- current error state
- `hasStreamed: boolean` -- whether streaming has occurred
- `steps: StepState[]` -- current review steps (for report-step delay detection)
- `onComplete: () => void` -- callback fired when completion delay finishes

### UseReviewCompletionResult (new, shared)

**Fields**:
- `isCompleting: boolean` -- whether in the completion delay window
- `skipDelay: () => void` -- cancel timer and call onComplete immediately
- `reset: () => void` -- clear timer and internal state for re-runs

### SessionError (existing, no changes)

Discriminated union for resume errors. Already defined as `StreamReviewError` in `@diffgazer/core/review`.

**Variants**:
- `{ code: "SESSION_STALE"; message: string }` -- session expired, should start fresh
- `{ code: "SESSION_NOT_FOUND"; message: string }` -- review doesn't exist, load saved or navigate away
- `{ code: "NO_DIFF"; message: string }` -- no changes to review
- `{ code: "AI_ERROR"; message: string }` -- AI provider error
- `{ code: "GENERATION_FAILED"; message: string }` -- generation failed
- `{ code: "STREAM_ERROR"; message: string }` -- generic stream error

### ReviewLifecycleDerivedState (new, shared pure functions)

Pure functions extracted from `useReviewLifecycle` in both apps. No hook state -- these are computed from stream state.

**Functions**:
- `isNoDiffError(error: string | null): boolean` -- checks if error contains "No staged changes" or "No unstaged changes"
- `isCheckingForChanges(isStreaming: boolean, steps: StepState[]): boolean` -- checks if diff step is still pending/active
- `getLoadingMessage(configLoading: boolean, settingsLoading: boolean, isCheckingForChanges: boolean, isInitializing: boolean): string | null` -- returns appropriate loading message or null

## Relationships

```
useReviewStream (shared, existing)
  └── provides: state, start, stop, abort, resume
        │
        ├── consumed by: useReviewStart (shared, new)
        │     └── uses: resume (with Result), start, getActiveSession
        │
        └── consumed by: useReviewCompletion (shared, new)
              └── reads: isStreaming, error, steps

useReviewLifecycle (per-app, existing)
  └── orchestrates: useReviewStream + useReviewStart + useReviewCompletion
  └── adds platform-specific: URL sync (web), phase machine (CLI), navigation
  └── computes derived state via: isNoDiffError, isCheckingForChanges, getLoadingMessage (shared pure functions)
```
