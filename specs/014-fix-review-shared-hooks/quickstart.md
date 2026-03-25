# Quickstart: Fix Review Regression & Consolidate Shared Review Hooks

## Prerequisites

- Node.js 20+, pnpm
- The diffgazer monorepo checked out on branch `014-fix-review-shared-hooks`
- `pnpm install` completed

## Build & Test

```bash
# Build all packages (required after modifying shared packages)
pnpm build

# Run web dev server (port 3001, proxies API to 3000)
pnpm dev:web

# Run CLI dev
pnpm dev:cli

# Type-check everything
pnpm type-check
```

## Key Files to Modify

### Phase 1: Fix Review Bugs (P1)

**Shared stream hook** (restore Result return type on resume):
- `packages/api/src/hooks/use-review-stream.ts`

**Web review hooks** (restore stale/not-found fallback logic):
- `apps/web/src/features/review/hooks/use-review-start.ts`
- `apps/web/src/features/review/hooks/use-review-lifecycle.ts`

**CLI review hooks** (fix start() no-op, hasStreamed stale read):
- `apps/cli/src/features/review/hooks/use-review-start.ts`
- `apps/cli/src/features/review/hooks/use-review-lifecycle.ts`
- `apps/cli/src/features/review/hooks/use-review-completion.ts`

### Phase 2: Consolidate Hooks (P2)

**New shared hooks**:
- `packages/api/src/hooks/use-review-start.ts` (NEW)
- `packages/api/src/hooks/use-review-completion.ts` (NEW)
- `packages/api/src/hooks/index.ts` (add exports)

**New shared pure functions**:
- `packages/core/src/review/lifecycle-helpers.ts` (NEW -- isNoDiffError, isCheckingForChanges, getLoadingMessage)
- `packages/core/src/review/index.ts` (add exports)

**App hooks updated to consume shared versions**:
- `apps/web/src/features/review/hooks/use-review-start.ts` (DELETE -- replaced by shared)
- `apps/web/src/features/review/hooks/use-review-completion.ts` (DELETE -- replaced by shared)
- `apps/web/src/features/review/hooks/use-review-lifecycle.ts` (update imports)
- `apps/cli/src/features/review/hooks/use-review-start.ts` (DELETE -- replaced by shared)
- `apps/cli/src/features/review/hooks/use-review-completion.ts` (DELETE -- replaced by shared)
- `apps/cli/src/features/review/hooks/use-review-lifecycle.ts` (update imports)

### Phase 3: Quality Cleanup (P3)

**Dead code removal**:
- `apps/cli/src/app/screens/status-screen.tsx` (DELETE -- unused, not in router)

**Display utils** (document scope, extract shared derived state):
- `packages/core/src/review/display.ts` (document as CLI-specific or reconcile)

## Verification Steps

1. `pnpm build` -- all packages build without errors
2. `pnpm type-check` -- no type errors
3. Start web (`pnpm dev:web`), run a review, verify it completes
4. Start CLI (`pnpm dev:cli`), run a review, verify it completes
5. Test stale session resume in web (navigate to old review URL)
6. Test "staged" mode restart in CLI (start review, cancel, start again)
7. Verify both apps import `useReviewStart` and `useReviewCompletion` from `@diffgazer/api/hooks`
