# Implementation Plan: Shared API Hooks Quality Audit & Improvement

**Branch**: `007-shared-hooks-audit` | **Date**: 2026-03-25 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/007-shared-hooks-audit/spec.md`

## Summary

Audit and fix 5 concrete issues in the shared API hooks implementation (006-shared-api-hooks): a query key hierarchy bug, duplicated platform wrappers, streaming hook API inconsistency, duplicated lens resolution logic, and missing query factory `all()` methods. Research confirmed no additional libraries are needed — the current TanStack Query v5 + `queryOptions()` pattern is canonical. One spec item (mutation invalidation promises) was found to be already correct during detailed audit.

## Technical Context

**Language/Version**: TypeScript 5.x (strict: true), ESM only, `.js` extensions in imports
**Primary Dependencies**: React 19, TanStack Query v5 (`@tanstack/react-query`), Ink 6 (CLI), Vite 7 (web), Hono (server)
**Storage**: N/A (in-memory query cache, no persistence changes)
**Testing**: Vitest (existing tests in both apps)
**Target Platform**: Web (browser) + CLI (Node.js terminal via Ink 6)
**Project Type**: Monorepo — shared hooks package (`@diffgazer/api/hooks`) consumed by web app and CLI app
**Performance Goals**: N/A (refactoring, no new performance requirements)
**Constraints**: Zero regressions in existing tests; both apps must continue working identically
**Scale/Scope**: 34 files in shared hooks (621 lines), 2 CLI wrappers (41 lines), 2 web wrappers (105 lines), ~10 files to modify

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Constitution file contains only template placeholders — no gates defined. **PASS** (no constraints to evaluate).

## Project Structure

### Documentation (this feature)

```text
specs/007-shared-hooks-audit/
├── plan.md              # This file
├── spec.md              # Feature specification
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── checklists/
│   └── requirements.md  # Spec quality checklist
└── tasks.md             # Phase 2 output (created by /speckit.tasks)
```

### Source Code (files to modify)

```text
packages/api/src/hooks/
├── queries/
│   ├── review.queries.ts       # FIX: list key hierarchy (US1)
│   ├── server.queries.ts       # FIX: add all() factory (US5)
│   └── git.queries.ts          # FIX: add all() factory (US5)
├── use-delete-review.ts        # FIX: use factory instead of hardcoded key (US1)
├── use-review-stream.ts        # FIX: consistent start/resume API + DRY abort (US3)
└── use-server-status.ts        # ENHANCE: add ServerState mapping (US2)

packages/api/src/hooks/index.ts # UPDATE: export ServerState type + enhanced useServerStatus

packages/core/src/review/        # ADD: resolveDefaultLenses utility (US4)
  OR packages/api/src/hooks/     # Alternative location

apps/cli/src/hooks/
└── use-server-status.ts        # DELETE: replaced by shared version (US2)

apps/web/src/hooks/
└── use-server-status.ts        # DELETE: replaced by shared version (US2)

apps/cli/src/app/screens/settings/
└── diagnostics-screen.tsx      # FIX: use shared useServerStatus (US2)

apps/cli/src/features/review/hooks/
└── use-review-lifecycle.ts     # FIX: use shared resolveDefaultLenses (US4)

apps/web/src/features/review/hooks/
└── use-review-settings.ts      # FIX: use shared resolveDefaultLenses (US4)
```

**Structure Decision**: No new directories needed. All changes fit within existing package structure. The shared hooks package (`packages/api/src/hooks/`) receives the consolidated `useServerStatus` wrapper and the `resolveDefaultLenses` utility (or alternatively, `resolveDefaultLenses` goes to `packages/core/src/review/` since it deals with lens domain logic).

## Implementation Phases

### Phase A: Fix Query Key Hierarchy (US1, P1)

**Scope**: 2 files, ~5 line changes

1. `packages/api/src/hooks/queries/review.queries.ts` line 10: Change `["reviews", projectPath]` to `[...reviewQueries.all(), "list", projectPath]`
2. `packages/api/src/hooks/use-delete-review.ts` line 12: Replace hardcoded `["reviews"]` with `reviewQueries.all()`

**Risk**: Low. Query keys are ephemeral (in-memory cache). Key change takes effect immediately.
**Verification**: Both apps still show review list correctly after deleting a review.

### Phase B: Consolidate useServerStatus (US2, P1)

**Scope**: 5 files — enhance 1, delete 2, update 2 consumers

1. Enhance `packages/api/src/hooks/use-server-status.ts`: Add `ServerState` type and state mapping logic (currently in both app wrappers)
2. Export `ServerState` type from `packages/api/src/hooks/index.ts`
3. Delete `apps/cli/src/hooks/use-server-status.ts`
4. Delete `apps/web/src/hooks/use-server-status.ts`
5. Update `apps/cli/src/app/screens/settings/diagnostics-screen.tsx` to use shared hook
6. Update all import paths in CLI and web that reference the local wrapper

**Risk**: Medium. Need to verify the shared hook's return type is compatible with both `HealthGate` components.
**Verification**: Both apps show server status correctly (checking → connected/error transitions).

### Phase C: Fix Streaming Hook (US3, P2)

**Scope**: 1 file, ~15 line changes

1. Extract `cancelStream()` helper from duplicated abort logic in `stop` and `abort`
2. Unify `start` and `resume` return types — both should return `void` (state-only errors), since the hook already manages all state via `dispatch`. Remove `Result` return from `resume`.

**Risk**: Medium. Need to check if any consumer of `resume` uses the return value.
**Verification**: Review streaming works identically in both apps (start, resume, stop, abort).

### Phase D: Consolidate resolveDefaultLenses (US4, P2)

**Scope**: 3 files — create 1, update 2

1. Extract `resolveDefaultLenses` + `FALLBACK_LENSES` to `packages/core/src/review/lenses.ts` (or add to existing review utilities)
2. Update `apps/cli/src/features/review/hooks/use-review-lifecycle.ts` to import from shared location
3. Update `apps/web/src/features/review/hooks/use-review-settings.ts` to import from shared location

**Risk**: Low. Pure function extraction, no behavioral change.
**Verification**: Both apps resolve lenses identically (valid → pass through, invalid → fallback).

### Phase E: Complete Query Factory Consistency (US5, P3)

**Scope**: 2 files, ~4 line additions

1. Add `all: () => ["server"] as const` to `packages/api/src/hooks/queries/server.queries.ts` and nest `health` under it
2. Add `all: () => ["git"] as const` to `packages/api/src/hooks/queries/git.queries.ts` and nest `status` and `diff` under it

**Risk**: Low. Same ephemeral cache reasoning as Phase A.
**Verification**: No functional change — this is structural consistency.

### Phase F: Verification & Regression Testing

1. Run `pnpm build` from workspace root
2. Run existing tests in both apps
3. Manual verification: start both apps, navigate all screens, perform a review

## Spec Corrections (from detailed audit)

**US6 / FR-009 / SC-006 (mutation invalidation promises)**: Detailed file-level audit revealed this is **already correctly implemented**. All 10 mutation hooks that perform invalidation already return the promise — either implicitly via concise arrow expressions (`() => qc.invalidateQueries(...)`) or explicitly via `async/await` (`async () => { await Promise.all([...]) }`). No changes needed. US6 can be marked as pre-satisfied.

## Complexity Tracking

No constitution violations to justify. All changes are minimal refactoring within existing patterns.
