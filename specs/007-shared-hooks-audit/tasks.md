# Tasks: Shared API Hooks Quality Audit & Improvement

**Input**: Design documents from `/specs/007-shared-hooks-audit/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, quickstart.md

**Tests**: No test tasks generated — not explicitly requested in the feature specification.

**Organization**: Tasks are grouped by user story. US6 (mutation invalidation promises) is excluded — detailed audit confirmed it is already correctly implemented.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: User Story 1 - Fix Query Key Hierarchy Bug (Priority: P1)

**Goal**: Fix the `reviewQueries.list` key to use hierarchical prefix and eliminate hardcoded query key strings in `useDeleteReview`.

**Independent Test**: Delete a review in both web and CLI → review list refreshes correctly. Invalidating `reviewQueries.all()` also invalidates the review list.

### Implementation for User Story 1

- [x] T001 [P] [US1] Fix `list` query key to use `reviewQueries.all()` prefix in `packages/api/src/hooks/queries/review.queries.ts` (line 10: change `["reviews", projectPath]` to `[...reviewQueries.all(), "list", projectPath]`)
- [x] T002 [P] [US1] Replace hardcoded `["reviews"]` with `reviewQueries.all()` in `packages/api/src/hooks/use-delete-review.ts` (line 12)

**Checkpoint**: Review list cache invalidation works correctly via hierarchical keys. Both apps refresh the review list after deletion.

---

## Phase 2: User Story 2 - Consolidate Duplicated useServerStatus (Priority: P1)

**Goal**: Eliminate 3 duplicate implementations of the server status mapping by enhancing the shared hook to return `ServerState` directly.

**Independent Test**: Both apps show server status transitions (checking → connected/error) using the single shared implementation. CLI diagnostics screen displays server status correctly.

### Implementation for User Story 2

- [x] T003 [US2] Enhance shared `useServerStatus` hook to include `ServerState` type and state mapping logic in `packages/api/src/hooks/use-server-status.ts` (add discriminated union mapping: `isLoading → "checking"`, `isSuccess → "connected"`, `error → "error"` with `retry` function)
- [x] T004 [US2] Export `ServerState` type from barrel in `packages/api/src/hooks/index.ts`
- [x] T005 [US2] Delete CLI wrapper `apps/cli/src/hooks/use-server-status.ts` and update import in `apps/cli/src/app/index.tsx` (line 18) to use shared hook from `@diffgazer/api/hooks`
- [x] T006 [US2] Delete web wrapper `apps/web/src/hooks/use-server-status.ts` and update imports in `apps/web/src/app/routes/__root.tsx` (line 7) and `apps/web/src/features/settings/components/diagnostics/page.tsx` (line 10) to use shared hook from `@diffgazer/api/hooks`
- [x] T007 [US2] Update CLI diagnostics screen `apps/cli/src/app/screens/settings/diagnostics-screen.tsx` (lines 36-39) to use the shared `useServerStatus` hook's `ServerState` return instead of manually deriving status from raw query result

**Checkpoint**: Server status works identically in both apps. Zero duplicate implementations remain. `HealthGate` and diagnostics screens all use the shared hook.

---

## Phase 3: User Story 3 - Fix Streaming Hook API Inconsistency (Priority: P2)

**Goal**: Make `start` and `resume` have consistent `void` return types and extract duplicated abort logic into a shared helper.

**Independent Test**: Start a review stream in both apps. Stop, abort, and resume all work correctly. No consumer references a `Result` return from `resume`.

### Implementation for User Story 3

- [x] T008 [US3] Extract shared abort logic into `cancelStream()` helper in `packages/api/src/hooks/use-review-stream.ts` (extract lines 77-80 and 85-88 into single function, use in both `stop` and `abort`)
- [x] T009 [US3] Change `resume` return type from `Promise<Result<void, StreamReviewError>>` to `Promise<void>` in `packages/api/src/hooks/use-review-stream.ts` (remove `Result` wrapping, keep error dispatch to state)
- [x] T010 [US3] Update `resume` consumer in `apps/cli/src/features/review/hooks/use-review-lifecycle.ts` (line 132: change `.then((result) => {...})` to use state-based error checking instead of return value)

**Checkpoint**: Streaming hook has consistent API. `start`, `resume` both return `void`. `stop`/`abort` share extracted abort logic. Review streaming works in both apps.

---

## Phase 4: User Story 4 - Consolidate resolveDefaultLenses (Priority: P2)

**Goal**: Extract duplicated lens resolution logic to a single shared location in `@diffgazer/core`.

**Independent Test**: Both apps resolve default lenses identically — valid lenses pass through, invalid/empty lenses return fallback array.

### Implementation for User Story 4

- [x] T011 [US4] Create `resolveDefaultLenses` utility and `FALLBACK_LENSES` constant in `packages/core/src/review/` (extract from CLI's `use-review-lifecycle.ts` lines 39-45, export from package barrel)
- [x] T012 [P] [US4] Update CLI to import `resolveDefaultLenses` from `@diffgazer/core` in `apps/cli/src/features/review/hooks/use-review-lifecycle.ts` (remove local implementation at lines 39-45)
- [x] T013 [P] [US4] Update web to import `resolveDefaultLenses` from `@diffgazer/core` in `apps/web/src/features/review/hooks/use-review-settings.ts` (remove inlined logic at lines 4-12)

**Checkpoint**: `resolveDefaultLenses` exists in exactly one location. Both apps import from shared package. Lens resolution works identically.

---

## Phase 5: User Story 5 - Complete Query Factory Consistency (Priority: P3)

**Goal**: Add `all()` factory method to `serverQueries` and `gitQueries` for hierarchical invalidation consistency.

**Independent Test**: All 5 query factories have an `all()` method. All sub-keys use the `all()` prefix.

### Implementation for User Story 5

- [x] T014 [P] [US5] Add `all()` factory method to `serverQueries` and nest `health` key under it in `packages/api/src/hooks/queries/server.queries.ts`
- [x] T015 [P] [US5] Add `all()` factory method to `gitQueries` and nest `status` and `diff` keys under it in `packages/api/src/hooks/queries/git.queries.ts`

**Checkpoint**: All query factories follow the same structure. Every factory has `all()` and every sub-key is nested under it.

---

## Phase 6: Verification & Polish

**Purpose**: Build verification, regression check, and documentation updates

- [x] T016 Build all packages from workspace root (`pnpm build`)
- [x] T017 Verify both apps start correctly (`pnpm dev:web` and `pnpm dev:cli`) and all screens render without errors
- [x] T018 Update shared hooks documentation in `apps/docs` or `.claude/docs/shared-hooks.md` to reflect corrected query key hierarchy, consolidated `useServerStatus`, and consistent streaming hook API
- [x] T019 Run quickstart.md validation — manual smoke test: server status, review streaming (start/stop/abort/resume), review deletion with list refresh

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (US1)**: No dependencies — can start immediately
- **Phase 2 (US2)**: No dependencies — can start immediately, parallel with Phase 1
- **Phase 3 (US3)**: No dependencies — can start immediately, parallel with Phases 1-2
- **Phase 4 (US4)**: No dependencies — can start immediately, parallel with Phases 1-3
- **Phase 5 (US5)**: No dependencies — can start immediately, parallel with Phases 1-4
- **Phase 6 (Polish)**: Depends on ALL user story phases complete

### User Story Dependencies

- **US1 (P1)**: Independent. Modifies `review.queries.ts` and `use-delete-review.ts` only.
- **US2 (P1)**: Independent. Modifies `use-server-status.ts` (shared), deletes app wrappers, updates imports.
- **US3 (P2)**: Independent. Modifies `use-review-stream.ts` and one consumer in CLI.
- **US4 (P2)**: Independent. Creates shared utility in `@diffgazer/core`, updates 2 consumers.
- **US5 (P3)**: Independent. Modifies `server.queries.ts` and `git.queries.ts` only.

**All 5 user stories are fully independent** — they touch different files with zero overlap. They can all be executed in parallel.

### Within Each User Story

- Tasks within a story should run sequentially unless marked [P]
- US1: T001 and T002 can run in parallel (different files)
- US2: T003 → T004 → T005/T006/T007 (T005-T007 depend on T003-T004 but can run in parallel with each other)
- US3: T008 → T009 → T010 (sequential — each builds on prior)
- US4: T011 → T012/T013 (T012 and T013 can run in parallel after T011)
- US5: T014 and T015 can run in parallel (different files)

### Parallel Opportunities

```text
# Maximum parallelism: All 5 user stories can run simultaneously

# Agent 1: US1 (2 tasks)
T001 [P] Fix review.queries.ts list key
T002 [P] Fix use-delete-review.ts hardcoded key

# Agent 2: US2 (5 tasks)
T003 → T004 → T005/T006/T007

# Agent 3: US3 (3 tasks)
T008 → T009 → T010

# Agent 4: US4 (3 tasks)
T011 → T012/T013

# Agent 5: US5 (2 tasks)
T014 [P] Fix server.queries.ts
T015 [P] Fix git.queries.ts

# After all agents complete:
T016 → T017 → T018 → T019
```

---

## Implementation Strategy

### MVP First (US1 + US2 Only)

1. Complete Phase 1: US1 — Fix query key hierarchy (2 tasks, ~5 min)
2. Complete Phase 2: US2 — Consolidate useServerStatus (5 tasks, ~15 min)
3. **STOP and VALIDATE**: Both P1 stories done. Test deletion + server status.
4. The two correctness bugs are fixed. Remaining stories are DRY/consistency improvements.

### Full Delivery (All 5 Stories)

1. Launch all 5 user stories in parallel (5 agents, 15 tasks)
2. Complete Phase 6: Verification (4 tasks)
3. Total: 19 tasks across 6 phases

### Single Developer (Sequential)

1. US1 (2 tasks) → US2 (5 tasks) → US3 (3 tasks) → US4 (3 tasks) → US5 (2 tasks) → Polish (4 tasks)
2. Each story checkpoint validates independently before proceeding

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- US6 (mutation invalidation promises) excluded — already correctly implemented per detailed audit
- All 5 user stories are fully independent — zero file overlap between stories
- Commit after each user story phase completes
- Stop at any checkpoint to validate independently
