# Implementation Plan: Fix Persistent Web Review Regression & Hooks Validation

**Branch**: `011-fix-review-validate-hooks` | **Date**: 2026-03-25 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/011-fix-review-validate-hooks/spec.md`

## Summary

Fix the web review regression where project context descriptions show instead of the streaming pipeline (lenses, agents, progress). Root cause: `useContextSnapshot` (lifecycle-aware, 3 timing guards) was replaced by `useReviewContext()` (fires eagerly on mount, no lifecycle awareness). Additionally, restore `requestAnimationFrame` event batching removed from the shared `useReviewStream` hook. Fix 3 hooks quality warnings. Verify CLI review flow and matchQueryState adoption.

## Technical Context

**Language/Version**: TypeScript 5.x (strict: true), ESM only, `.js` extensions in imports
**Primary Dependencies**: React 19, TanStack Query v5, Ink 6 (CLI), Vite 7 (web)
**Storage**: N/A (in-memory query cache, no persistence changes)
**Testing**: vitest, `@testing-library/react`
**Target Platform**: Node.js (CLI via Ink) + Browser (web via Vite)
**Project Type**: Shared React hooks library + dual-platform consumer apps
**Performance Goals**: Streaming UI smooth with hundreds of SSE events (rAF batching)
**Constraints**: Zero new dependencies, backward-compatible hook signatures, both platforms must continue working
**Scale/Scope**: ~6 files modified across 2 packages

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Constitution is a template with no project-specific gates. No violations possible. Gate passes.

**Post-Phase 1 re-check**: No violations. Changes are bug fixes and quality improvements within existing packages. No new abstractions, no new dependencies.

## Project Structure

### Documentation (this feature)

```text
specs/011-fix-review-validate-hooks/
├── plan.md              # This file
├── spec.md              # Feature specification
├── research.md          # Root cause analysis, fix approach, quality audit
├── data-model.md        # Code change specifications
├── quickstart.md        # Implementation guide
├── checklists/
│   └── requirements.md  # Spec quality checklist
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

### Source Code (repository root)

```text
packages/api/src/hooks/
├── review.ts                     # MODIFIED — useReviewContext accepts { enabled } option
├── use-review-stream.ts          # MODIFIED — add platform-aware rAF batching
├── index.ts                      # MODIFIED — remove unused type exports

apps/web/src/features/review/
├── components/review-container.tsx  # MODIFIED — lifecycle-aware context fetch + invalidation
├── hooks/use-review-lifecycle.ts    # VERIFIED — no changes needed (correct as-is)

apps/web/src/features/review/hooks/use-review-start.test.ts  # VERIFIED — tests already correct
```

**Structure Decision**: All changes are within existing files. No new files created. The fix touches 2 layers: shared hooks package and web app consumer.

## Implementation Phases

### Phase 1: Fix Context Fetch Timing (P1 — Primary Bug)

The `useReviewContext()` query fires eagerly on mount with no lifecycle awareness. This shows stale/wrong context data before and after streaming.

**1a. Shared hook: useReviewContext accepts enabled option**

File: `packages/api/src/hooks/review.ts`

Change `useReviewContext()` to accept an optional `{ enabled }` parameter, matching the pattern already used by `useOpenRouterModels`:

```typescript
export function useReviewContext(options?: { enabled?: boolean }) {
  const api = useApi();
  return useQuery({ ...reviewQueries.context(api), ...options });
}
```

This is backward-compatible — callers without `options` get the default behavior (enabled by default).

**1b. Web consumer: Add lifecycle guard**

File: `apps/web/src/features/review/components/review-container.tsx`

Replace the eager context fetch with a lifecycle-aware one:

```typescript
const contextStep = state.steps.find(s => s.id === 'context');
const contextReady = contextStep?.status === 'completed' && !!state.reviewId;
const { data: contextData } = useReviewContext({ enabled: contextReady });
const contextSnapshot = contextReady ? contextData ?? null : null;
```

This restores the old `useContextSnapshot` timing semantics:
- No fetch until review session is established (`reviewId` set)
- No fetch until context step has completed
- Display only when context is ready

### Phase 2: Restore rAF Event Batching (P1 — Performance)

File: `packages/api/src/hooks/use-review-stream.ts`

Replace the synchronous event dispatch with platform-aware batching:

```typescript
const eventQueueRef = useRef<ReviewEvent[]>([]);
const rafIdRef = useRef<number | null>(null);

const flushEvents = () => {
  const events = eventQueueRef.current;
  eventQueueRef.current = [];
  rafIdRef.current = null;
  for (const event of events) {
    dispatch({ type: "EVENT", event });
  }
};

const dispatchEvent = (event: ReviewEvent) => {
  // review_started must dispatch immediately (sets reviewId)
  if (event.type === 'review_started') {
    dispatch({ type: "EVENT", event });
    return;
  }

  eventQueueRef.current.push(event);

  if (typeof requestAnimationFrame !== 'undefined') {
    if (rafIdRef.current === null) {
      rafIdRef.current = requestAnimationFrame(flushEvents);
    }
  } else {
    // Node.js (CLI/Ink): dispatch synchronously
    flushEvents();
  }
};
```

Add cleanup in the effect:
```typescript
useEffect(() => {
  return () => {
    cancelStream();
    if (rafIdRef.current !== null && typeof cancelAnimationFrame !== 'undefined') {
      cancelAnimationFrame(rafIdRef.current);
    }
    // Flush any remaining events
    if (eventQueueRef.current.length > 0) {
      for (const event of eventQueueRef.current) {
        dispatch({ type: "EVENT", event });
      }
      eventQueueRef.current = [];
    }
  };
}, []);
```

### Phase 3: Hooks Quality Fixes (P2)

**3a. Remove unused type exports**

File: `packages/api/src/hooks/index.ts`

Change:
```typescript
export { useReviewStream, type ReviewStreamState } from "./use-review-stream.js";
export { useServerStatus, type ServerState, useShutdown } from "./server.js";
```

To:
```typescript
export { useReviewStream } from "./use-review-stream.js";
export { useServerStatus, useShutdown } from "./server.js";
```

**3b. STREAM_ERROR constant** (optional)

File: `packages/api/src/hooks/use-review-stream.ts:146`

The `"STREAM_ERROR" as const` string literal is acceptable — no shared constant exists for this value. Leave as-is unless a constant is added to schemas.

### Phase 4: Verification

1. Type-check: `pnpm run type-check`
2. Build: `pnpm build`
3. Run web tests: `cd apps/web && pnpm test`
4. Manual test:
   - Start dev server: `pnpm dev`
   - Navigate to review, trigger "Review Changes" with staged changes
   - Verify: step indicators, agent cards, activity log render during streaming
   - Verify: context snapshot appears only after context step completes
   - Make code changes, start another review (stale session scenario)
   - Verify: detects stale, falls back to fresh start, streams full pipeline
5. CLI test: `pnpm dev:cli` → review → verify streaming renders correctly

## Parallelism Strategy

**Maximum parallelism: 6 agents**

Phases 1-2 touch different files and can run in parallel:

- **Agent 1**: Phase 1a — `useReviewContext` enabled option (shared hook)
- **Agent 2**: Phase 1b — `review-container.tsx` lifecycle guard (after Agent 1)
- **Agent 3**: Phase 2 — rAF batching in `use-review-stream.ts`
- **Agent 4**: Phase 3a — remove unused exports from `index.ts`
- **Agent 5**: Phase 4 — type-check, build, tests (after Agents 1-4)
- **Agent 6**: Manual verification (after Agent 5)

**Realistic allocation: 3 agents** with batching:
- Agent 1: Phase 1a + 3a (shared hooks changes — `review.ts` + `index.ts`)
- Agent 2: Phase 1b + 2 (web consumer + rAF batching — `review-container.tsx` + `use-review-stream.ts`)
- Agent 3: Phase 4 (verification)

## Complexity Tracking

No constitution violations. No complexity justifications needed.
