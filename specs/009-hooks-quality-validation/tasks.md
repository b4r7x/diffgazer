# Tasks: Shared API Hooks Quality Validation & Pattern Audit

**Input**: Design documents from `/specs/009-hooks-quality-validation/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: User Story 1 - Validate matchQueryState Pattern (Priority: P1) MVP

**Goal**: Fix the matchQueryState check order bug (data-first per TkDodo's recommendation) and remove the unused `empty` handler. This prevents background refetch failures from hiding valid cached data.

**Independent Test**: After fix, a `RefetchErrorResult` (query with both `error` and stale `data`) should show the cached data via `success` handler, not the error handler. Both web and CLI apps build and pass tests.

### Implementation for User Story 1

- [x] T001 [US1] Fix matchQueryState check order and remove empty handler in `packages/api/src/hooks/match-query-state.ts` — swap `data !== undefined` check before `error` check, remove `empty` from `QueryStateHandlers` interface, simplify function body to 4 lines

**Checkpoint**: matchQueryState correctly preserves stale data during background refetch failures

---

## Phase 2: User Story 3 - Audit for Anti-Slop and Code Quality (Priority: P2)

**Goal**: Remove dead code and YAGNI violations identified by the 5 audit agents. Three independent cleanup items in separate files.

**Independent Test**: All files deleted/modified are confirmed unused by consumers. Both apps build and type-check successfully.

### Implementation for User Story 3

- [x] T002 [P] [US3] Delete orphaned query factory file `packages/api/src/hooks/queries/git.ts` — entire file is dead code (hooks removed in 008, factory left behind, not exported from index.ts)
- [x] T003 [P] [US3] Remove unused `single()` and `list()` factories from `packages/api/src/hooks/queries/trust.ts` — keep only `all()` method, remove `queryOptions` import if no longer needed
- [x] T004 [P] [US3] Remove unused `batchEvents` option from `packages/api/src/hooks/use-review-stream.ts` — delete `UseReviewStreamOptions` interface, remove `options` parameter from `useReviewStream`, simplify `dispatchEvent` to direct `dispatch({ type: "EVENT", event })`, update `index.ts` barrel to remove `UseReviewStreamOptions` type export

**Checkpoint**: Zero dead code or YAGNI violations remain in the hooks package

---

## Phase 3: User Story 2 - TanStack Query Patterns Verification (Priority: P1)

**Goal**: Confirm all hooks follow canonical TanStack Query v5 patterns. No code changes — validation only.

**Independent Test**: Inspection of all query factories and mutation hooks confirms canonical patterns.

### Verification for User Story 2

- [x] T005 [US2] Verify all query factories use `queryOptions()` with hierarchical keys and `all()` root — inspect `packages/api/src/hooks/queries/config.ts`, `review.ts`, `server.ts`, `trust.ts` — confirm each factory co-locates key, queryFn, and staleTime

**Checkpoint**: All hooks confirmed canonical — no code changes needed

---

## Phase 4: User Story 4 - Research Alternative Patterns (Priority: P3)

**Goal**: Confirm research report documents matchQueryState vs 3+ alternatives with clear recommendation.

**Independent Test**: `research.md` contains comparison table with verdicts for useSuspenseQuery, ts-pattern, React 19 use(), and @suspensive/react-query.

### Verification for User Story 4

- [x] T006 [US4] Verify research report completeness in `specs/009-hooks-quality-validation/research.md` — confirm it documents at least 3 alternative patterns with verdicts, sources, and a clear recommendation to keep matchQueryState

**Checkpoint**: Research report complete with evidence-based recommendation

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Final verification that all changes are correct and no regressions introduced

- [x] T007 Run type-check across entire workspace: `pnpm run type-check`
- [x] T008 Build both apps: `pnpm build`
- [x] T009 Verify `packages/api/src/hooks/index.ts` barrel exports are unchanged (no public API removed except `UseReviewStreamOptions` type)
- [x] T010 Verify all imports from `@diffgazer/api/hooks` resolve correctly in both `apps/cli/` and `apps/web/`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (US1)**: No dependencies — can start immediately
- **Phase 2 (US3)**: No dependencies — can start immediately, parallel with Phase 1
- **Phase 3 (US2)**: No dependencies — verification only, can run anytime
- **Phase 4 (US4)**: No dependencies — verification only, can run anytime
- **Phase 5 (Polish)**: Depends on Phase 1 + Phase 2 completion

### User Story Dependencies

- **User Story 1 (P1)**: Independent — single file change
- **User Story 2 (P1)**: Independent — verification only, no code changes
- **User Story 3 (P2)**: Independent — 3 separate files, all parallelizable
- **User Story 4 (P3)**: Independent — documentation verification only

### Parallel Opportunities

- T001 can run in parallel with T002, T003, T004 (different files)
- T002, T003, T004 are all [P] (different files, no dependencies)
- T005 and T006 are verification-only and can run anytime
- T007-T010 must wait for all code changes (T001-T004)

---

## Parallel Example: Maximum Parallelism

```bash
# Launch all code changes in parallel (4 agents, all different files):
Agent 1: T001 — Fix matchQueryState in match-query-state.ts
Agent 2: T002 — Delete queries/git.ts
Agent 3: T003 — Simplify queries/trust.ts
Agent 4: T004 — Remove batchEvents from use-review-stream.ts

# After all complete, run verification:
Agent 5: T005 + T006 — Pattern and research verification
Agent 6: T007 + T008 + T009 + T010 — Build and integration check
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete T001: Fix matchQueryState check order
2. Run T007-T008: Verify builds pass
3. **STOP and VALIDATE**: matchQueryState correctly handles RefetchErrorResult

### Full Delivery

1. T001-T004 in parallel (all code changes)
2. T005-T006 (verification)
3. T007-T010 (polish/integration check)
4. Done — total: 10 tasks, ~4 parallelizable

---

## Notes

- All code changes are in `packages/api/src/hooks/` — no consumer app changes needed
- `UseReviewStreamOptions` is the only type export being removed — verify no consumers import it
- The `empty` handler removal from `matchQueryState` is safe because no consumer passes it
- `queries/git.ts` deletion is safe because it's not imported or exported anywhere
