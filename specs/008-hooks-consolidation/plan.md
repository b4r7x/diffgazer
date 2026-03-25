# Implementation Plan: Shared API Hooks Consolidation

**Branch**: `008-hooks-consolidation` | **Date**: 2026-03-25 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/008-hooks-consolidation/spec.md`

## Summary

Consolidate the shared API hooks package (`@diffgazer/api/hooks`) from 25+ single-hook files into ~8 domain-grouped files, remove 6 unused hooks and 4 unused query factory re-exports, rename `.queries.ts` files to plain `.ts`, and introduce a `matchQueryState()` utility for reducing loading/error/empty state boilerplate across both web (React DOM) and CLI (Ink) apps.

## Technical Context

**Language/Version**: TypeScript 5.x (strict: true), ESM only, `.js` extensions in imports
**Primary Dependencies**: React 19, TanStack Query v5 (`@tanstack/react-query`), Ink 6 (CLI), Vite 7 (web)
**Storage**: N/A (in-memory query cache, no persistence changes)
**Testing**: vitest, `@testing-library/react`
**Target Platform**: Node.js (CLI via Ink) + Browser (web via Vite)
**Project Type**: Shared React hooks library (subpath of `@diffgazer/api`)
**Performance Goals**: N/A (refactoring, no behavioral changes)
**Constraints**: Zero new npm dependencies, identical public API surface for used hooks, both platforms must continue working
**Scale/Scope**: 25+ hook files → ~8 files, 6 hooks removed, 5 query files renamed, 1 utility added

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Constitution is a template with no project-specific gates defined. No violations possible. Gate passes.

## Project Structure

### Documentation (this feature)

```text
specs/008-hooks-consolidation/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── checklists/
│   └── requirements.md  # Spec quality checklist
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

### Source Code (repository root)

```text
packages/api/src/hooks/           # PRIMARY - all changes here
├── context.ts                    # KEEP - ApiProvider + useApi (unchanged)
├── config.ts                     # NEW - consolidated: useSettings, useInit, useConfigCheck,
│                                 #   useProviderStatus, useOpenRouterModels, useSaveSettings,
│                                 #   useSaveConfig, useActivateProvider, useDeleteProviderCredentials
├── review.ts                     # NEW - consolidated: useReviews, useReview,
│                                 #   useActiveReviewSession, useReviewContext,
│                                 #   useDeleteReview, useRefreshReviewContext
├── trust.ts                      # NEW - consolidated: useSaveTrust, useDeleteTrust
├── server.ts                     # NEW - consolidated: useServerStatus, useShutdown
├── use-review-stream.ts          # KEEP - complex streaming hook (unchanged)
├── match-query-state.ts          # NEW - loading state utility
├── queries/                      # RENAME files, keep structure
│   ├── config.ts                 # RENAMED from config.queries.ts
│   ├── review.ts                 # RENAMED from review.queries.ts
│   ├── server.ts                 # RENAMED from server.queries.ts
│   ├── trust.ts                  # RENAMED from trust.queries.ts
│   └── git.ts                    # RENAMED from git.queries.ts (kept for future use)
├── index.ts                      # UPDATED - barrel re-exports from new files
└── [25 use-*.ts files]           # DELETED after consolidation

packages/api/src/hooks/queries/
└── index.ts                      # UPDATED - remove .queries imports

apps/web/src/                     # VERIFY - no import changes needed
apps/cli/src/                     # VERIFY - no import changes needed
```

**Structure Decision**: No new directories. All changes are within the existing `packages/api/src/hooks/` directory. Files are consolidated and renamed in-place. The `queries/` subdirectory is preserved with renamed files. Consumer apps (`apps/web/`, `apps/cli/`) require zero import changes since the barrel export (`index.ts`) maintains the same public API.

## Implementation Phases

### Phase 1: Rename Query Factory Files (Low risk, no consumer impact)

1. Rename `queries/config.queries.ts` → `queries/config.ts`
2. Rename `queries/review.queries.ts` → `queries/review.ts`
3. Rename `queries/server.queries.ts` → `queries/server.ts`
4. Rename `queries/trust.queries.ts` → `queries/trust.ts`
5. Rename `queries/git.queries.ts` → `queries/git.ts`
6. Update `queries/index.ts` imports
7. Update all `use-*.ts` files that import from `./queries/*.queries.js`
8. Build and verify

### Phase 2: Remove Unused Hooks + Re-exports (Dead code removal)

1. Delete hook files: `use-trust.ts`, `use-trusted-projects.ts`, `use-git-status.ts`, `use-git-diff.ts`, `use-run-drilldown.ts`, `use-delete-config.ts`
2. Remove their exports from `index.ts`
3. Remove unused query factory re-exports from `index.ts` (keep only `configQueries`)
4. Remove `queries/index.ts` barrel (only needed for re-exports, internal imports can go direct)
5. Build both apps and run tests

### Phase 3: Consolidate Hook Files by Domain

For each domain, create a single file containing all queries + mutations:

1. **`config.ts`**: Merge `use-settings.ts`, `use-init.ts`, `use-config-check.ts`, `use-provider-status.ts`, `use-openrouter-models.ts`, `use-save-settings.ts`, `use-save-config.ts`, `use-activate-provider.ts`, `use-delete-provider-credentials.ts`
2. **`review.ts`**: Merge `use-reviews.ts`, `use-review.ts`, `use-active-review-session.ts`, `use-review-context.ts`, `use-delete-review.ts`, `use-refresh-review-context.ts`
3. **`trust.ts`**: Merge `use-save-trust.ts`, `use-delete-trust.ts`
4. **`server.ts`**: Merge `use-server-status.ts`, `use-shutdown.ts`
5. Delete all merged `use-*.ts` files
6. Update `index.ts` barrel to re-export from new domain files
7. Build both apps and run tests

### Phase 4: Add Loading State Utility

1. Create `match-query-state.ts` with `matchQueryState()` utility
2. Export from `index.ts`
3. Demonstrate in one CLI screen (e.g., history-screen)
4. Demonstrate in one web page (e.g., history page)
5. Verify identical behavior before/after

### Phase 5: Verification + Documentation

1. Full build of both apps
2. Run all tests
3. Verify public API surface matches pre-consolidation (same hook names exported)
4. Update `shared-hooks.md` documentation to reflect new file structure
5. Update invalidation map if any hooks were merged

## Parallelism Strategy

- Phase 1 (rename) and Phase 2 (remove dead code) can be done sequentially but are both low-risk and fast
- Phase 3 (consolidation) is the bulk of the work -- each domain file can be consolidated independently by parallel agents
- Phase 4 (utility) depends on Phase 3 completing (imports change)
- Phase 5 (verification) runs last

Estimated agent allocation:
- Phase 1-2: 1 agent (simple renames/deletes)
- Phase 3: 4 parallel agents (one per domain: config, review, trust, server)
- Phase 4: 2 parallel agents (one CLI demo, one web demo)
- Phase 5: 1 agent (verification)

## Complexity Tracking

No constitution violations. No complexity justifications needed.
