# Research: Fix Web Review Regression & Hooks Quality Finalization

**Date**: 2026-03-25
**Method**: 9 parallel Opus agents performing investigation, code audit, and design research

## Root Cause Investigation

### Finding: Resume-to-fresh-start fallback removed in commit `9c4c807`

**Decision**: The bug is purely client-side. Commit `9c4c807` ("audit and improve shared API hooks quality") removed error handling from the resume path in `use-review-start.ts`.

**Before** (working): When `resume()` returned a `Result` with `SESSION_STALE` or `SESSION_NOT_FOUND`, `useReviewStart` called `startFresh()` as a fallback.

**After** (broken): `resume()` was changed to `Promise<void>` (fire-and-forget). On resume failure, the shared hook dispatches `RESET` internally, but nothing triggers a fresh start. Additionally, `useReviewCompletion` falsely fires on the `START→RESET` transition.

**Server confirmed clean**: 3 agents verified the server pipeline is untouched. `/api/review/stream` and `/api/review/context` are independent endpoints. The SSE stream never emits project context data.

**CLI has the same bug**: The CLI's `useReviewLifecycle` (line 122) also calls `void stream.resume(reviewId)` fire-and-forget with no error handling, and has the same completion detection false trigger (lines 146-151).

## Fix Approach: Resume Returns Result

### Decision: Option A — Make `resume()` return `Result<void, StreamReviewError>` again

**Rationale**:
1. **Simplest**: The transport layer already returns Result. The shared hook currently swallows it. Adding `return result;` is a one-line change per branch.
2. **Both platforms**: Web and CLI consumers can handle the result identically. No platform-specific adaptation needed.
3. **Most testable**: Tests assert on return values, not effect chains. The stale test file already expects this exact API.
4. **No new abstractions**: No new state fields, no callbacks, no effect chains.
5. **Backward compatible**: Callers using `void resume(id)` still work (void discards the result).

**Alternatives rejected**:

| Option | Rejected because |
|--------|-----------------|
| B: `needsRestart` state flag | Adds reducer complexity, requires useEffect chain, stale closure risk |
| C: `onResumeFailed` callback | Changes hook API to event-emitter hybrid, awkward timing |
| D: Self-healing resume | Resume doesn't know mode/lenses, couples concerns |

### Decision: Completion guard uses `reviewId !== null`

**Rationale**: A real review always sets `reviewId` early (from `review_started` SSE event). A `START→RESET` transition never sets `reviewId`. A legitimate review with 0 issues still has a `reviewId`. Single-token change: add `&& reviewIdRef.current !== null` to the guard condition.

**Alternatives rejected**:

| Guard | Rejected because |
|-------|-----------------|
| Steps progressed | More complex, race condition window |
| Issues > 0 | Wrong: legitimate review can find 0 issues |

## Hooks Quality Audit

### Decision: Implementation quality is 8.5/10. Two warnings to fix, eight info-level items.

**Warnings (fix in this spec)**:

| # | File | Issue | Fix |
|---|------|-------|-----|
| W1 | `review.ts:32` | `useDeleteReview` constructs query key manually (`[...reviewQueries.all(), id]`) instead of using `reviewQueries.detail(api, id).queryKey` | Use factory method |
| W2 | `.claude/docs/shared-hooks.md` | References `batchEvents` callback that was removed | Remove reference |

**Info-level (acceptable as-is)**:

| # | Issue | Why acceptable |
|---|-------|---------------|
| I1 | Section comments in config.ts and index.ts | Aid scannability in domain-grouped files |
| I2 | `ServerState` type exported but unused | Zero runtime cost, useful contract |
| I3 | `ReviewStreamState` type exported but unused | Same as above |
| I4 | `queries/trust.ts` is 3 lines | Consistent with factory pattern |
| I5 | `serverQueries.health` returns `true as const` | TQ convention for success indicators |
| I6 | `useServerStatus.retry` wraps refetch in arrow | Intentionally returns void |
| I7 | Duplicate abort controller preamble in start/resume | Readable, extracting hurts clarity |
| I8 | Barrel comment couples to specific consumer | Minor, not worth standalone change |

## matchQueryState Validation

### Decision: Valid React pattern. Keep and expand adoption.

**Rationale**:
- Pure function called during render — no hook rules violations
- React 19 Compiler compatible (not a component or hook, compiler ignores it)
- No unnecessary re-renders (called synchronously, result is ReactNode)
- Community-recognized pattern (Gabriel Pichot blog, Atomic Object blog)
- Check order correct: `isLoading → data → error → fallback loading`

**Alternatives evaluated**:

| Alternative | Verdict | Reason |
|-------------|---------|--------|
| `useSuspenseQuery` | Not viable | Ink Suspense-for-data-fetching untested at scale |
| `ts-pattern` | Overkill | Adds 4KB dependency for 3-state check |
| React 19 `use()` | Not replacement | No caching, deduplication, retry |
| `@suspensive/react-query` | Redundant | Hooks already in TQ v5 natively |

### matchQueryState adoption candidates

**CLI (8 files)**:
1. `apps/cli/src/features/onboarding/components/steps/provider-step.tsx`
2. `apps/cli/src/features/onboarding/components/steps/model-step.tsx`
3. `apps/cli/src/app/screens/settings/providers-screen.tsx`
4. `apps/cli/src/app/screens/settings/agent-execution-screen.tsx`
5. `apps/cli/src/app/screens/settings/analysis-screen.tsx`
6. `apps/cli/src/app/screens/settings/storage-screen.tsx`
7. `apps/cli/src/app/screens/settings/trust-permissions-screen.tsx`
8. `apps/cli/src/features/home/components/trust-panel.tsx`

**Web (2 files)**:
1. `apps/web/src/features/settings/components/agent-execution/page.tsx`
2. `apps/web/src/features/settings/components/storage/page.tsx`

**Documented exceptions** (not candidates):
- Multi-query: config-provider.tsx, diagnostics screens
- Mutation-only: trust-panel.tsx (web), onboarding-wizard.tsx
- Hook returns: use-config-guard.ts, use-openrouter-models.ts, use-server-status
- Imperative: review-screen.tsx (inside useEffect)

## Sources

- TkDodo: "Status Checks in React Query" (data-first check order)
- TanStack Query v5 docs: queryOptions, useSuspenseQuery, skipToken
- Gabriel Pichot: "Simplify TanStack React Query State Handling"
- Ink GitHub: React 19 support, Suspense compatibility
- ts-pattern GitHub: exhaustiveness checking limitations with UseQueryResult
