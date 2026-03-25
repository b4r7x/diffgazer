# Tasks: Fix Web Review Regression & Hooks Quality Finalization

**Input**: Design documents from `/specs/010-fix-review-validate-hooks/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md

**Tests**: Test updates included for US1 (stale test file must be fixed as part of the regression fix).

**Organization**: Tasks grouped by user story. US1 has a dependency chain (shared hook first, then consumers). US2-US4 are independent of each other and can run after US1 completes.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: User Story 1 - Fix Resume Fallback & Completion Guard (Priority: P1) MVP

**Goal**: Restore the resume-to-fresh-start fallback that was removed in commit `9c4c807`. When a review session resume fails (stale, not found), the system automatically starts a fresh review. Prevent false completion triggers on START→RESET transitions.

**Independent Test**: Start server, run a review to create a session, make code changes, start another review. The second review should detect the stale session and automatically start a fresh review with full agent orchestration.

### Implementation for User Story 1

- [x] T001 [US1] Change `resume()` return type to `Promise<Result<void, StreamReviewError>>` in `packages/api/src/hooks/use-review-stream.ts` — add `return result;` at end of each branch in the try block (ok, stale/not-found, other error). Import `Result` from `@diffgazer/core/result` and `StreamReviewError` from `../review.js`. Keep all existing dispatch calls unchanged.
- [x] T002 [US1] Export `StreamReviewError` type from `packages/api/src/hooks/index.ts` — add `export type { StreamReviewError } from "../review.js";`
- [x] T003 [P] [US1] Restore resume error handling in `apps/web/src/features/review/hooks/use-review-start.ts` — change both `void resume(id)` calls to `await resume(id)`, check result: on `SESSION_STALE` or `SESSION_NOT_FOUND` call `startFresh()`, import `ReviewErrorCode` from `@diffgazer/schemas/review`
- [x] T004 [P] [US1] Add `reviewId` guard to completion detection in `apps/web/src/features/review/hooks/use-review-completion.ts:42` — change condition to `wasStreaming && !isStreaming && hasStreamed && !error && reviewIdRef.current !== null`
- [x] T005 [P] [US1] Restore resume error handling in CLI `apps/cli/src/features/review/hooks/use-review-lifecycle.ts:122` — change `void stream.resume(activeReviewId)` to `const result = await stream.resume(activeReviewId); if (!result.ok) { startFresh(); }`, import `Result` type
- [x] T006 [P] [US1] Add `reviewId` guard to CLI completion detection in `apps/cli/src/features/review/hooks/use-review-lifecycle.ts:146` — add `&& stream.state.reviewId !== null` to the `wasStreaming && !isStreaming` guard condition
- [x] T007 [US1] Update stale test file `apps/web/src/features/review/hooks/use-review-start.test.ts` — remove `onNotFoundInSession` from defaultProps, update `resume` mock to return `Result<void, StreamReviewError>`, verify tests 1-3 (basic start, resume, auto-resume) pass, verify tests 4-6 (stale/not-found fallback) align with restored behavior, remove or update test 7 (onNotFoundInSession removed)
- [x] T008 [US1] Build and type-check both apps: `pnpm run type-check && pnpm build`

**Checkpoint**: Resume→fallback→fresh-start works in both web and CLI. No false completion triggers on START→RESET.

---

## Phase 2: User Story 2 - Hooks Quality Fixes (Priority: P1)

**Goal**: Fix the two warning-level quality findings and remove unnecessary comments. Zero warnings remain in the hooks package audit.

**Independent Test**: Run code audit on all hooks files — zero warnings or critical issues. Both apps build and type-check successfully.

### Implementation for User Story 2

- [x] T009 [P] [US2] Fix manual query key in `packages/api/src/hooks/review.ts:32` — change `qc.removeQueries({ queryKey: [...reviewQueries.all(), id] })` to `qc.removeQueries({ queryKey: reviewQueries.detail(api, id).queryKey })`
- [x] T010 [P] [US2] Remove unnecessary section comments from `packages/api/src/hooks/config.ts` — delete `// Query hooks` (line 6) and `// Mutation hooks` (line 33)
- [x] T011 [P] [US2] Remove unnecessary section comments from `packages/api/src/hooks/index.ts` — delete all section comments (`// Context`, `// Config domain`, `// Review domain`, `// Trust domain`, `// Server domain`, `// Streaming hook`, `// Utilities`, `// Query factory`)
- [x] T012 [US2] Build and type-check: `pnpm run type-check && pnpm build`

**Checkpoint**: Hooks package audit produces zero critical or warning-level findings.

---

## Phase 3: User Story 3 - matchQueryState Adoption (Priority: P2)

**Goal**: Convert ~10 components from manual `if (isLoading)... if (error)...` guards to `matchQueryState`. Achieve 80%+ adoption across single-query guard components.

**Independent Test**: Convert one component, verify identical visual behavior. Count total single-query guard components — at least 80% use matchQueryState.

### Implementation for User Story 3

**CLI conversions** (8 files, all parallelizable):

- [x] T013 [P] [US3] Convert `apps/cli/src/features/onboarding/components/steps/provider-step.tsx` to use `matchQueryState` — import from `@diffgazer/api/hooks`, replace manual `if (isLoading)... if (error)...` with guard clause pattern
- [x] T014 [P] [US3] Convert `apps/cli/src/features/onboarding/components/steps/model-step.tsx` to use `matchQueryState`
- [x] T015 [P] [US3] Convert `apps/cli/src/app/screens/settings/providers-screen.tsx` to use `matchQueryState` — note: combines query error with mutation error, may need to keep mutation error handling separate
- [x] T016 [P] [US3] Convert `apps/cli/src/app/screens/settings/agent-execution-screen.tsx` to use `matchQueryState`
- [x] T017 [P] [US3] Convert `apps/cli/src/app/screens/settings/analysis-screen.tsx` to use `matchQueryState`
- [x] T018 [P] [US3] Convert `apps/cli/src/app/screens/settings/storage-screen.tsx` to use `matchQueryState`
- [x] T019 [P] [US3] Convert `apps/cli/src/app/screens/settings/trust-permissions-screen.tsx` to use `matchQueryState`
- [x] T020 [P] [US3] Convert `apps/cli/src/features/home/components/trust-panel.tsx` to use `matchQueryState`

**Web conversions** (2 files):

- [x] T021 [P] [US3] Convert `apps/web/src/features/settings/components/agent-execution/page.tsx` to use `matchQueryState`
- [x] T022 [P] [US3] Convert `apps/web/src/features/settings/components/storage/page.tsx` to use `matchQueryState`

- [x] T023 [US3] Build and type-check both apps: `pnpm run type-check && pnpm build`

**Checkpoint**: At least 80% of single-query guard components use matchQueryState. All screens render identically.

---

## Phase 4: User Story 4 - Documentation Update (Priority: P3)

**Goal**: Shared hooks documentation accurately reflects the current implementation — no references to removed features, correct file tree, matchQueryState documented.

**Independent Test**: Compare every statement in `.claude/docs/shared-hooks.md` against actual source code — 100% accuracy.

### Implementation for User Story 4

- [x] T024 [US4] Update `.claude/docs/shared-hooks.md` — (1) remove `batchEvents` callback reference from useReviewStream section, (2) document `resume()` now returns `Result<void, StreamReviewError>`, (3) add matchQueryState section with check order, guard clause pattern, platform compatibility, (4) update architecture file tree to match post-consolidation structure (domain files, no `use-*.ts` individual files), (5) update "What Still Uses Direct API Calls" if any changes

**Checkpoint**: Documentation accuracy is 100%.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Final verification across all changes.

- [x] T025 Run full type-check: `pnpm run type-check`
- [x] T026 Build both apps: `pnpm build`
- [x] T027 Run web tests: `cd apps/web && pnpm test` — verify all use-review-start tests pass
- [x] T028 Verify all imports from `@diffgazer/api/hooks` resolve in both `apps/cli/` and `apps/web/`
- [x] T029 Run quickstart.md validation: verify the manual test scenario (stale session fallback) described in `specs/010-fix-review-validate-hooks/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (US1)**: No dependencies — can start immediately. T001-T002 must complete before T003-T007 (shared hook changes first, then consumers)
- **Phase 2 (US2)**: No dependencies on US1 — can run in parallel with US1 (different files)
- **Phase 3 (US3)**: No dependencies on US1 or US2 — can run in parallel (different files)
- **Phase 4 (US4)**: Should run after US1 completes (documents resume Result return type)
- **Phase 5 (Polish)**: Depends on all user stories completing

### User Story Dependencies

- **User Story 1 (P1)**: Internal chain: T001→T002→(T003,T004,T005,T006 parallel)→T007→T008
- **User Story 2 (P1)**: Independent — all tasks are in `packages/api/src/hooks/` but different lines than US1
- **User Story 3 (P2)**: Independent — all tasks are in `apps/*/` component files, no overlap with US1/US2
- **User Story 4 (P3)**: Depends on US1 (documents the resume fix)

### Within Each User Story

- US1: Shared hook first (T001-T002), then consumers parallel (T003-T006), then tests (T007), then build (T008)
- US2: All quality fixes parallel (T009-T011), then build (T012)
- US3: All conversions parallel (T013-T022), then build (T023)
- US4: Single doc update (T024)

### Parallel Opportunities

**Maximum parallelism across stories**: US1 (T003-T006), US2 (T009-T011), and US3 (T013-T022) can all run simultaneously after T001-T002 complete — up to 17 parallel agents.

**Within US1**: T003, T004, T005, T006 are parallel (4 different files)
**Within US2**: T009, T010, T011 are parallel (3 different files)
**Within US3**: T013-T022 are all parallel (10 different files)

---

## Parallel Example: Maximum Throughput

```bash
# Step 1: Shared hook change (sequential, blocks everything in US1)
Agent 1: T001 — Change resume return type in use-review-stream.ts
Agent 1: T002 — Export StreamReviewError from index.ts

# Step 2: All consumer changes + quality + adoption (parallel, 17 agents)
Agent 2: T003 — Web use-review-start.ts resume handling
Agent 3: T004 — Web use-review-completion.ts guard
Agent 4: T005 — CLI use-review-lifecycle.ts resume handling
Agent 5: T006 — CLI use-review-lifecycle.ts completion guard
Agent 6: T009 — Fix query key in review.ts
Agent 7: T010 — Remove comments from config.ts
Agent 8: T011 — Remove comments from index.ts
Agent 9: T013 — provider-step.tsx matchQueryState
Agent 10: T014 — model-step.tsx matchQueryState
Agent 11: T015 — providers-screen.tsx matchQueryState
Agent 12: T016 — agent-execution-screen.tsx matchQueryState
Agent 13: T017 — analysis-screen.tsx matchQueryState
Agent 14: T018 — storage-screen.tsx matchQueryState
Agent 15: T019 — trust-permissions-screen.tsx matchQueryState
Agent 16: T020 — trust-panel.tsx matchQueryState
Agent 17: T021 — web agent-execution/page.tsx matchQueryState
Agent 18: T022 — web storage/page.tsx matchQueryState

# Step 3: Tests + docs (after Step 2)
Agent 19: T007 — Update stale tests
Agent 20: T024 — Documentation update

# Step 4: Verification
Agent 21: T008, T012, T023, T025-T029 — Build, type-check, test
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete T001-T002: Shared hook resume return type
2. Complete T003-T006: Consumer error handling + completion guards
3. Complete T007: Test updates
4. Complete T008: Build verification
5. **STOP and VALIDATE**: Start server, test stale session fallback manually

### Incremental Delivery

1. US1 → Resume fix verified → Core regression fixed
2. US2 → Quality warnings resolved → Clean audit
3. US3 → matchQueryState adopted → Consistent loading patterns
4. US4 → Docs updated → Implementation fully documented
5. Phase 5 → Final verification → Ready to merge

### Parallel Agent Strategy

**Minimum (4 agents)**:
- Agent 1: T001-T002 (shared hook), then T003-T004 (web), then T007 (tests)
- Agent 2: T005-T006 (CLI)
- Agent 3: T009-T011 (quality), then T013-T017 (CLI matchQueryState)
- Agent 4: T018-T022 (remaining matchQueryState), then T024 (docs), then T025-T029 (verification)

**Maximum (21 agents)**: See parallel example above.

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- T001-T002 are the critical path — everything in US1 depends on them
- US2 and US3 are fully independent and can start before US1 finishes
- US4 should wait for US1 (documents the resume Result return type)
- The test file (T007) already has tests for the correct behavior — they just need mock updates to match the restored API
- matchQueryState conversions (T013-T022) should pass the raw `UseQueryResult` object, not destructured fields
- Some CLI screens combine query error with mutation error — those need the mutation error handled separately outside matchQueryState
