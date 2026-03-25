# Research: Fix Persistent Web Review Regression & Hooks Validation

**Date**: 2026-03-25
**Method**: 8 parallel Opus agents performing code tracing, git diff analysis, quality audit, and pattern validation

## Root Cause Investigation

### Finding 1: `useReviewContext()` replaces `useContextSnapshot` with different lifecycle semantics (HIGH)

**Decision**: This is the primary cause of "descriptions showing instead of lenses/agents."

**Before** (main): `useContextSnapshot` had 3 guards:
1. Required `reviewId` to be set (no fetch until a review session was established)
2. Required either `!isStreaming` or `contextStepCompleted === true`
3. A `contextFetchRef` that deduplicated fetches per reviewId and reset when streaming restarted

**After** (010 branch): `useReviewContext()` from shared hooks fires `GET /api/review/context` immediately on mount with `staleTime: 60_000` and no `enabled` guard. The timing suppression in `review-container.tsx:52` (`state.isStreaming ? null : contextData ?? null`) only suppresses **display**, not fetch.

**Impact**:
- Fetches context eagerly before any review starts (may show stale data from a previous review)
- After streaming completes, shows cached context from the eager fetch (not the fresh context from the current review)
- During the brief window between mount and first streaming event, the progress view renders with empty steps/agents but populated contextSnapshot
- The 60s `staleTime` means subsequent review runs within 60s won't re-fetch context

**Evidence**:
- `review-container.tsx:50-52`: `const { data: contextData } = useReviewContext();`
- Old `use-context-snapshot.ts` (deleted on 010 branch): had `enabled: !!reviewId && (contextStepCompleted || !isStreaming)`
- User reports: "it seems that some general project context is being made there, that's ok, but not at the cost of the entire implementation"

### Finding 2: `requestAnimationFrame` event batching removed (MEDIUM)

**Decision**: This is a performance regression that makes the streaming UI feel broken/janky.

**Before** (main): The web-local `useReviewStream` batched non-`review_started` events via `requestAnimationFrame`. Multiple events per animation frame were accumulated and dispatched in a single batch, reducing re-renders.

**After** (010 branch): The shared `useReviewStream` dispatches every SSE event synchronously:
```typescript
const dispatchEvent = (event: ReviewEvent) => {
  dispatch({ type: "EVENT", event });
};
```

**Impact**: During a review with hundreds of agent/step/enrich events, each triggers a separate React state update → re-render. React 19's auto-batching does NOT apply because dispatches happen inside an async SSE parsing loop (not inside React event handlers or React transitions).

**Evidence**: Old `use-review-stream.ts` (deleted) had `requestAnimationFrame` batching. New `packages/api/src/hooks/use-review-stream.ts:63-65` dispatches synchronously.

### Finding 3: `onReviewNotInSession` fallback path simplified (MEDIUM)

**Decision**: Behavioral change, not a bug. URL-bookmarked completed reviews with no active server session now start fresh instead of loading saved results.

**Before** (main): `onReviewNotInSession(reviewId)` → `loadSavedOrFresh(reviewId)` → try `api.getReview(reviewId)`, if has results show them directly, else start fresh.

**After** (010 branch): `SESSION_NOT_FOUND` → `startFresh()`. The saved review loading still works via the page-level `loading-saved` phase when `hasReviewId` is true on initial mount.

**Evidence**: `page.tsx` still handles `loading-saved` phase (lines 91-108). The removed callback was only for the case where `useReviewStart` tried to resume an active session by URL ID and it came back not-found — now falls through to fresh start.

## Complete Rendering Pipeline Trace

```
ReviewPage (page.tsx:68)
  Phase: "streaming" (when no reviewId in URL)
  └── ReviewContainer (review-container.tsx:36)
        ├── useReviewLifecycle() → { state, loadingMessage, isConfigured, ... }
        │   ├── useReviewStream() → { state, start, stop, resume }
        │   ├── useReviewSettings() → { loading, defaultLenses }
        │   ├── useConfigData() → { isConfigured, provider, model }
        │   ├── useReviewStart() → { hasStartedRef, hasStreamedRef }
        │   └── useReviewCompletion() → { skipDelayAndComplete }
        ├── useReviewContext() → { data: contextData }  ← FIRES EAGERLY
        └── Render:
            ├── if loadingMessage → ReviewLoadingMessage
            ├── if !isConfigured → ApiKeyMissingView
            ├── if isNoDiffError → NoChangesView
            └── else → ReviewProgressView
                  ├── Left: ProgressList + AgentBoard + ContextSnapshotPreview
                  └── Right: ActivityLog
```

**Data source for streaming UI**: `state` from `useReviewStream()` (steps, agents, events, issues) — CORRECT
**Data source for context**: `useReviewContext()` — FIRES TOO EARLY, no lifecycle awareness

## Fix Approach

### Fix 1: Restore lifecycle-aware context fetching

**Decision**: Add `enabled` guard to `useReviewContext()` usage in `review-container.tsx` and invalidate context cache after streaming completes.

**Rationale**:
- The old `useContextSnapshot` waited for `reviewId` + `contextStepCompleted`. We should restore this timing.
- Options: (A) add `enabled` at the call site, (B) create a new lifecycle-aware wrapper, (C) inline the old `useContextSnapshot` logic.
- Option A is simplest: pass `{ enabled: contextStepCompleted && !!state.reviewId }` to a modified `useReviewContext` call, then invalidate context after streaming completes.

**Alternatives rejected**:

| Option | Rejected because |
|--------|-----------------|
| B: New wrapper hook | Adds unnecessary abstraction; the logic is 2 lines |
| C: Restore useContextSnapshot | Re-introduces deleted file; old hook had browser-specific refs |

### Fix 2: Add rAF batching to shared useReviewStream

**Decision**: Add platform-aware batching to `useReviewStream` — use `requestAnimationFrame` in browser, synchronous in Node.js (CLI).

**Rationale**:
- The CLI runs in Node.js (Ink) where `requestAnimationFrame` is not available.
- The shared hook must work in both environments.
- Solution: detect `typeof requestAnimationFrame !== 'undefined'` and batch only in browser.
- Alternatively: accept the per-event dispatch and rely on React 19's `startTransition` or `unstable_batchedUpdates`, but these don't apply to async dispatches outside React event handlers.

**Alternatives rejected**:

| Option | Rejected because |
|--------|-----------------|
| React 19 `startTransition` | Doesn't batch synchronous dispatches in async callbacks |
| `unstable_batchedUpdates` | Deprecated in React 19, may be removed |
| Per-app wrapper | Duplicates streaming logic in both apps |

### Fix 3: Verify completion guard is sufficient

**Decision**: The `reviewIdRef.current !== null` guard (010 fix) is confirmed correct by all 4 agents. No additional fix needed.

**Evidence**:
- RESET sets `reviewId: null` in streamReducer (line 37)
- ERROR sets `state.error` which is blocked by `!error` guard
- COMPLETE preserves reviewId (set earlier by `review_started` SSE event)
- `hasStreamed` is set eagerly (before streaming starts) but doesn't cause issues because `reviewId` guard compensates

## Hooks Quality Audit

### Decision: Quality is 8.5/10. 0 critical, 3 warnings, 4 info.

**Warnings**:

| # | File | Issue | Fix |
|---|------|-------|-----|
| W1 | `index.ts:28` | `ReviewStreamState` type exported but never imported by any consumer | Remove from barrel |
| W2 | `index.ts:26` | `ServerState` type exported but never imported by any consumer | Remove from barrel |
| W3 | `use-review-stream.ts:146` | `"STREAM_ERROR" as const` string literal in catch block | Import constant if one exists, else accept |

**Info** (acceptable as-is):

| # | Issue | Why acceptable |
|---|-------|---------------|
| I1 | `queries/trust.ts` is 3 lines (only `all()`) | Consistent factory pattern, real invalidation purpose |
| I2 | No co-located tests for shared hooks | Tested indirectly through consumer tests |
| I3 | `useOpenRouterModels` accepts `options` spread unlike other hooks | Driven by real consumer need (`enabled` passthrough) |
| I4 | `useReview` adds `enabled: !!id` outside factory | Reasonable separation: factory = what, hook = when |

**What passed**: Anti-slop clean, all mutation hooks use factory methods for cache keys, SRP correct, no thin wrappers, no dead code, barrel exports match consumers.

## matchQueryState Validation

### Decision: Valid React 19 pattern. Keep and expand.

**Validation results**:
- **React 19 Compiler**: Compatible — pure function, not a hook, compiler ignores it
- **Re-renders**: Neutral — called during render synchronously, introduces no state
- **Check order**: Correct — `isLoading → data !== undefined → error → fallback loading()`
- **Edge cases**: Handles background refetch (data-first avoids error flash), disabled queries (fallback loading), stale data (success with existing data)

**Consumer inventory**:
- 12 components currently use matchQueryState (9 CLI, 3 web)
- 2 components could convert (web analysis page, web providers page)
- 12 components correctly use manual guards (multi-query, lifecycle, non-render contexts)
- All 12 current consumers use the guard clause pattern correctly

**Minor cosmetic**: 4 CLI consumers need `as ReactElement` cast because `matchQueryState` returns `ReactNode` but component return types expect `ReactElement`. Not a bug.

## Documentation Audit

### Decision: 100% accurate. No inaccuracies found.

Verified: file tree, hook counts (9/6/2/2), query key hierarchy (14 keys), invalidation map (9 mutations), platform configs, code snippets, "What Still Uses Direct API Calls" table, peerDependencies, platform-specific wrappers.

No references to removed features (batchEvents, etc.) found.

## Sources

- 8 parallel Opus agents: review-page-tracer, review-flow-tracer, git-diff-analyzer, completion-analyzer, cli-review-analyzer, hooks-quality-auditor, matchquery-validator, docs-accuracy-auditor
- Git diff analysis: `git diff main -- apps/web/src/features/review/`
- TanStack Query v5 docs: queryOptions, staleTime, enabled
