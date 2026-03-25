# Quickstart: Fix Persistent Web Review Regression & Hooks Validation

## Problem

The web review shows project context descriptions instead of the streaming pipeline (lenses, agents, progress). Root cause: `useContextSnapshot` (lifecycle-aware) was replaced by `useReviewContext()` (fires eagerly, no lifecycle guards). Additionally, rAF event batching was removed from the shared streaming hook.

## Fix Summary

1. Add `enabled` guard to `useReviewContext()` in `review-container.tsx` (wait for context step completion)
2. Make `useReviewContext` accept `options?: { enabled?: boolean }` in `packages/api/src/hooks/review.ts`
3. Add rAF batching to `use-review-stream.ts` for browser environments
4. Invalidate context cache after streaming completes
5. Remove unused type exports from hooks barrel

## Key Files

| File | Change |
|------|--------|
| `packages/api/src/hooks/review.ts` | `useReviewContext` accepts `{ enabled }` option |
| `packages/api/src/hooks/use-review-stream.ts` | Add rAF batching for browser, sync for Node.js |
| `packages/api/src/hooks/index.ts` | Remove `ReviewStreamState`, `ServerState` type exports |
| `apps/web/src/features/review/components/review-container.tsx` | Add `enabled` guard to `useReviewContext()`, invalidate on complete |
| `apps/web/src/features/review/hooks/use-review-lifecycle.ts` | Pass context invalidation on completion |

## Verification

```bash
pnpm run type-check        # Type check all packages
pnpm build                 # Build all
cd apps/web && pnpm test   # Run web tests
pnpm dev                   # Manual: start review, verify streaming UI
```

## What NOT to Change

- Server pipeline (untouched, correct)
- `useReviewStart` resume fallback (010 fix, correct)
- `useReviewCompletion` guard (010 fix, correct)
- CLI `useReviewLifecycle` (correct, already has fixes)
- matchQueryState (validated, no changes needed)
- Documentation (100% accurate, no changes needed)
