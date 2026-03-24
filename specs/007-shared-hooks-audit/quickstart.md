# Quickstart: Shared API Hooks Quality Audit

**Branch**: `007-shared-hooks-audit`

## What This Feature Does

Fixes 5 concrete issues found in the shared API hooks implementation:
1. Query key hierarchy bug causing broken cache invalidation
2. Duplicated `useServerStatus` wrapper across CLI and web (3 implementations → 1)
3. Inconsistent streaming hook API (`start` vs `resume` return types)
4. Duplicated `resolveDefaultLenses` logic across CLI and web
5. Missing `all()` factories in 2 query key groups

One original spec item (mutation invalidation promises) was found to already be correctly implemented — no changes needed.

## Prerequisites

- Node.js 20+
- pnpm 9+
- `pnpm install` from workspace root

## Implementation Order

Execute phases A→E in order. Each phase is independently testable.

### Phase A: Fix Query Key Hierarchy (US1)

**Files**: `packages/api/src/hooks/queries/review.queries.ts`, `packages/api/src/hooks/use-delete-review.ts`

1. In `review.queries.ts`: Change `list` key from `["reviews", projectPath]` to `[...reviewQueries.all(), "list", projectPath]`
2. In `use-delete-review.ts`: Replace hardcoded `["reviews"]` with `reviewQueries.all()`
3. Verify: `pnpm dev:web` → delete a review → list refreshes. `pnpm dev:cli` → same test.

### Phase B: Consolidate useServerStatus (US2)

**Files**: 5 files to modify, 2 to delete

1. Enhance `packages/api/src/hooks/use-server-status.ts` to include `ServerState` type and state mapping
2. Export `ServerState` from barrel (`packages/api/src/hooks/index.ts`)
3. Delete `apps/cli/src/hooks/use-server-status.ts`
4. Delete `apps/web/src/hooks/use-server-status.ts`
5. Update `apps/cli/src/app/screens/settings/diagnostics-screen.tsx` to use shared hook
6. Update all imports referencing deleted wrappers
7. Verify: Both apps show server status correctly. CLI diagnostics screen works.

### Phase C: Fix Streaming Hook (US3)

**File**: `packages/api/src/hooks/use-review-stream.ts`

1. Extract shared abort logic into `cancelStream()` helper
2. Change `resume` to return `void` instead of `Result`
3. Update any consumer that checks `resume` return value
4. Verify: Start a review in both apps. Stop/abort/resume work correctly.

### Phase D: Consolidate resolveDefaultLenses (US4)

**Files**: 3 files

1. Create utility in `packages/core/src/review/` (or add to existing review utilities)
2. Update `apps/cli/src/features/review/hooks/use-review-lifecycle.ts` to import shared version
3. Update `apps/web/src/features/review/hooks/use-review-settings.ts` to import shared version
4. Verify: Both apps resolve lenses correctly (valid → pass through, invalid → fallback).

### Phase E: Complete Query Factory Consistency (US5)

**Files**: `packages/api/src/hooks/queries/server.queries.ts`, `packages/api/src/hooks/queries/git.queries.ts`

1. Add `all()` to both factories
2. Nest existing keys under `all()` prefix
3. Verify: No functional change — `pnpm build` passes.

## Verification

After all phases:

```bash
pnpm build                    # Build all packages
pnpm --filter @diffgazer/api build  # Rebuild shared hooks package
# Run existing tests if available
```

Manual smoke test:
- Start server: `pnpm dev:cli` → verify server status checking → connected
- Start review → verify streaming works → stop/abort
- Delete a review → verify list refreshes
- Check all settings screens in both apps
