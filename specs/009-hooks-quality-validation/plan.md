# Implementation Plan: Shared API Hooks Quality Validation & Pattern Audit

**Branch**: `009-hooks-quality-validation` | **Date**: 2026-03-25 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/009-hooks-quality-validation/spec.md`

## Summary

Validate the shared API hooks architecture (`@diffgazer/api/hooks`) for quality, correctness, and adherence to React 19 / TanStack Query v5 best practices. Fix the `matchQueryState` check order bug (data-first per TkDodo's recommendation), remove dead code left from 008-hooks-consolidation (orphaned `queries/git.ts`, unused `trustQueries.single`/`list`, unused `batchEvents` option), and remove the unused `empty` handler from `matchQueryState`. Produce a research report documenting validation findings and library comparison.

## Technical Context

**Language/Version**: TypeScript 5.x (strict: true), ESM only, `.js` extensions in imports
**Primary Dependencies**: React 19, TanStack Query v5 (`@tanstack/react-query`), Ink 6 (CLI), Vite 7 (web)
**Storage**: N/A (in-memory query cache, no persistence changes)
**Testing**: vitest, `@testing-library/react`
**Target Platform**: Node.js (CLI via Ink) + Browser (web via Vite)
**Project Type**: Shared React hooks library (subpath of `@diffgazer/api`) + consumer apps
**Performance Goals**: N/A (validation/cleanup, no behavioral additions)
**Constraints**: Zero new dependencies, identical public API surface for all used hooks, both platforms must continue working
**Scale/Scope**: 5 files modified, 1 file deleted, 0 files created (source code only)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Constitution is a template with no project-specific gates defined. No violations possible. Gate passes.

**Post-Phase 1 re-check**: No violations. Changes are purely cleanup and bug-fix within an existing package. No new abstractions, no new dependencies.

## Project Structure

### Documentation (this feature)

```text
specs/009-hooks-quality-validation/
├── plan.md              # This file
├── spec.md              # Feature specification
├── research.md          # Phase 0: agent findings consolidated
├── data-model.md        # Phase 1: matchQueryState interface changes
├── quickstart.md        # Phase 1: validation checklist
├── checklists/
│   └── requirements.md  # Spec quality checklist
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

### Source Code (repository root)

```text
packages/api/src/hooks/
├── match-query-state.ts          # MODIFIED — fix check order (data-first), remove empty handler
├── use-review-stream.ts          # MODIFIED — remove batchEvents option
├── queries/
│   ├── git.ts                    # DELETE — entirely orphaned
│   └── trust.ts                  # MODIFIED — remove unused single()/list() factories
└── index.ts                      # MODIFIED — remove UseReviewStreamOptions type export
```

**Structure Decision**: All changes are within the existing `packages/api/src/hooks/` directory. No new files, no new directories. Consumer apps (`apps/web/`, `apps/cli/`) require zero changes. The only public API change is the removal of the unused `UseReviewStreamOptions` type export.

## Implementation Phases

### Phase 1: Fix matchQueryState Check Order (Medium priority — correctness bug)

Fix the status check order from error-first to data-first, following TkDodo's recommendation. This prevents a background refetch failure (TanStack Query's `RefetchErrorResult`) from hiding valid cached data.

**Current** (`match-query-state.ts:15-21`):
```typescript
if (query.isLoading) return handlers.loading();
if (query.error) return handlers.error(query.error);        // ← hides stale data
if (query.data !== undefined) { ... }
return handlers.loading();
```

**Fixed**:
```typescript
if (query.isLoading) return handlers.loading();
if (query.data !== undefined) {                              // ← data-first
  return handlers.success(query.data);
}
if (query.error) return handlers.error(query.error);
return handlers.loading();
```

Also remove the `empty` handler (unused by all consumers, semantically incorrect fallback to `loading()`).

**Files**: `packages/api/src/hooks/match-query-state.ts`

### Phase 2: Remove Dead Code (Low priority — cleanup)

Three cleanup items left from 008-hooks-consolidation:

1. **Delete `queries/git.ts`**: Entire file is orphaned. `useGitStatus`/`useGitDiff` hooks were removed in 008, but the query factory file was left behind. Not exported from `index.ts`, not imported by any file.

2. **Simplify `queries/trust.ts`**: Remove `single()` and `list()` factories — the hooks that consumed them (`useTrust`, `useTrustedProjects`) were removed in 008. Only `all()` is used (for invalidation in `trust.ts`).

3. **Remove `batchEvents` from `useReviewStream`**: The option is defined in `UseReviewStreamOptions` but never passed by any consumer (CLI or web). The implementation wraps each event in a single-element array, so the "batching" capability advertised by the name was never functional.

**Files**: `queries/git.ts` (delete), `queries/trust.ts` (modify), `use-review-stream.ts` (modify)

### Phase 3: Verification

1. Build both apps: `pnpm build`
2. Run all tests: `cd packages/api && pnpm test` (if tests exist), then verify both apps
3. Type-check: `pnpm run type-check`
4. Verify public API: confirm `index.ts` exports are unchanged
5. Verify consumers: confirm all imports from `@diffgazer/api/hooks` still resolve

### Phase 4: Documentation

1. Update `research.md` with consolidated agent findings (already generated)
2. No documentation changes needed for consumers — all changes are internal

## Parallelism Strategy

All 3 code changes (Phase 1 + Phase 2) are independent and can be done by parallel agents:

- **Agent 1**: Fix `match-query-state.ts` (Phase 1)
- **Agent 2**: Delete `queries/git.ts` + simplify `queries/trust.ts` (Phase 2a-b)
- **Agent 3**: Remove `batchEvents` from `use-review-stream.ts` (Phase 2c)
- **Agent 4**: Verification (Phase 3, after 1-3 complete)

Estimated: 4 agents, sequential dependency only on Phase 3 (verification).

## Complexity Tracking

No constitution violations. No complexity justifications needed.
