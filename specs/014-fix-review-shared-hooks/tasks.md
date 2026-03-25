# Tasks: Fix Review Regression & Consolidate Shared Review Hooks

**Input**: Design documents from `/specs/014-fix-review-shared-hooks/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/shared-review-hooks.md, quickstart.md

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Phase 1: Foundational (Blocking Prerequisites)

**Purpose**: Restore the shared `useReviewStream.resume` Result return type. This change is required by BOTH US1 (web fix) and US2 (CLI fix) and must complete before either story can proceed.

- [x] T001 Restore `Result<void, StreamReviewError>` return type on `resume()` in `packages/api/src/hooks/use-review-stream.ts`. For `SESSION_STALE` and `SESSION_NOT_FOUND` errors: return the error Result without dispatching RESET or ERROR. For other errors: dispatch ERROR internally AND return the error Result. For success: keep existing behavior (dispatch SET_REVIEW_ID, stream, COMPLETE) and return `ok(undefined)`. Import `Result`, `ok` from `@diffgazer/core/result` and `StreamReviewError`, `ReviewErrorCode` from `@diffgazer/core/review`. See contracts/shared-review-hooks.md for exact behavior spec.
- [x] T002 Build shared packages to verify T001 compiles: run `pnpm --filter @diffgazer/api build` and `pnpm --filter @diffgazer/core build`. Fix any type errors.

**Checkpoint**: `useReviewStream.resume` returns `Result`. Both apps can now be fixed independently.

---

## Phase 2: User Story 1 - Web Review Completes Successfully (Priority: P1)

**Goal**: Fix the web review flow so it no longer hangs on fresh start, stale resume, or not-found resume.

**Independent Test**: Start a review from the web UI, verify it streams to completion and shows results. Navigate to `/review/<old-id>` with a stale session -- verify fallback to fresh start.

### Implementation for User Story 1

- [x] T003 [US1] Update `resume` type in web `useReviewStart` options from `(id: string) => Promise<void>` to `(id: string) => Promise<Result<void, StreamReviewError>>` in `apps/web/src/features/review/hooks/use-review-start.ts`. When `resume(reviewId)` returns `SESSION_STALE`: call `start({ mode, lenses })` (fresh start). When `resume(reviewId)` returns `SESSION_NOT_FOUND`: call an `onNotFoundInSession?.(reviewId)` callback passed via options. Apply same error handling to the `getActiveSession -> resume(session.reviewId)` path.
- [x] T004 [US1] Restore `onReviewNotInSession` (or equivalent) callback support in `apps/web/src/features/review/hooks/use-review-lifecycle.ts`. Add it to the `useReviewStart` options so that when a resume-by-ID gets `SESSION_NOT_FOUND`, the lifecycle can navigate the user to load saved results or show an appropriate message. Wire the callback from the parent page component through the lifecycle hook.
- [x] T005 [P] [US1] Fix unstable effect dependencies in `apps/web/src/features/review/hooks/use-review-start.ts`. Store `start`, `resume`, `getActiveSession` functions in refs (assign on each render). Read from refs inside the start effect. Remove the functions from the effect dependency array. Apply same pattern for `defaultLenses` array (store in ref). This prevents unnecessary effect re-fires on every render since React Compiler is not active.
- [x] T006 [US1] Verify web review works end-to-end: run `pnpm dev:web`, start a staged review, confirm it streams to completion and shows results. Confirm no console errors. Check that navigating to a review URL with a non-existent session does not hang.

**Checkpoint**: Web review works. Fresh start, stale resume, and not-found resume all handle correctly.

---

## Phase 3: User Story 2 - CLI Review Completes Successfully (Priority: P1)

**Goal**: Fix the CLI review flow so it actually starts streaming and transitions through phases to results.

**Independent Test**: Run `pnpm dev:cli`, start a review, verify it streams to completion and shows results. Test with both "staged" and "unstaged" modes. Test restart after cancel.

### Implementation for User Story 2

- [x] T007 [US2] Fix `start()` in `apps/cli/src/features/review/hooks/use-review-lifecycle.ts` to actually trigger the review stream, not just call `setMode()`. Add a `startToken` state (`useState(0)`) that increments each time `start()` is called. Include `startToken` in `useReviewStart`'s dependency array. Reset `hasStartedRef.current = false` inside `start()` before incrementing the token so the effect's guard passes. This ensures the stream starts even when mode value doesn't change (e.g., "staged" to "staged").
- [x] T008 [US2] Convert `hasStreamedRef` to `useState<boolean>(false)` in `apps/cli/src/features/review/hooks/use-review-lifecycle.ts`. Replace all `hasStreamedRef.current = true/false` assignments with `setHasStreamed(true/false)`. Pass the `hasStreamed` boolean (now reactive state) to `useReviewCompletion`. Update `useReviewStart` in `apps/cli/src/features/review/hooks/use-review-start.ts` to accept a `setHasStreamed` setter instead of writing to a ref.
- [x] T009 [US2] Update `resume` type in CLI `useReviewStart` options from `(id: string) => Promise<void>` to `(id: string) => Promise<Result<void, StreamReviewError>>` in `apps/cli/src/features/review/hooks/use-review-start.ts`. Handle `SESSION_STALE` by calling `start({ mode, lenses })`. For `SESSION_NOT_FOUND`, call `start({ mode, lenses })` as well (CLI has no URL-based resume, so always fresh-start on errors).
- [x] T010 [P] [US2] Fix unstable effect dependencies in `apps/cli/src/features/review/hooks/use-review-start.ts`. Same pattern as T005: store `start`, `resume`, `getActiveSession` in refs, read from refs in effect, remove from dependency array. Store `defaultLenses` in ref.
- [x] T011 [US2] Verify CLI review works end-to-end: run `pnpm dev:cli`, start a staged review, confirm it streams to completion and shows results with keyboard navigation. Start an "unstaged" review and confirm it also works. Test: start review, cancel/reset, start again with same mode -- confirm it starts correctly.

**Checkpoint**: CLI review works. Both modes start and complete. Restart after cancel works.

---

## Phase 4: User Story 3 - Shared Review Hooks Eliminate Duplication (Priority: P2)

**Goal**: Consolidate `useReviewStart` and `useReviewCompletion` into `@diffgazer/api/hooks`. Extract shared derived-state functions into `@diffgazer/core/review`. Both apps consume shared hooks with zero duplication.

**Independent Test**: Both apps import start and completion hooks from `@diffgazer/api/hooks`. Both review flows still pass their P1 acceptance scenarios.

### Implementation for User Story 3

- [x] T012 [P] [US3] Create `packages/core/src/review/lifecycle-helpers.ts` with three pure functions: `isNoDiffError(error: string | null): boolean` (checks "No staged changes" / "No unstaged changes"), `isCheckingForChanges(isStreaming: boolean, steps: StepState[]): boolean` (checks diff step status), `getLoadingMessage(opts: { configLoading: boolean; settingsLoading: boolean; isCheckingForChanges: boolean; isInitializing: boolean }): string | null`. Add exports to `packages/core/src/review/index.ts`.
- [x] T013 [P] [US3] Create `packages/api/src/hooks/use-review-start.ts` implementing the shared `useReviewStart` hook per contracts/shared-review-hooks.md. Accept `UseReviewStartOptions` with optional `reviewId`. Expose imperative `startReview()` function. Return `{ startReview, hasStarted, hasStreamed }` as reactive state. Use ref-based stable callback pattern for `start`, `resume`, `getActiveSession`, `defaultLenses`. Handle resume Result errors per contract (SESSION_STALE -> fresh start, SESSION_NOT_FOUND -> return error status for lifecycle to handle).
- [x] T014 [P] [US3] Create `packages/api/src/hooks/use-review-completion.ts` implementing the shared `useReviewCompletion` hook per contracts/shared-review-hooks.md. Accept `UseReviewCompletionOptions` with `onComplete: () => void` callback. Detect `isStreaming` true->false transition. Compute delay from report step status (2300ms if report completed, 400ms otherwise). Return `{ isCompleting, skipDelay, reset }`. Store `onComplete` in ref for stable reference.
- [x] T015 [US3] Add exports to `packages/api/src/hooks/index.ts`: export `useReviewStart`, `UseReviewStartOptions`, `UseReviewStartResult` from `./use-review-start.js`. Export `useReviewCompletion`, `UseReviewCompletionOptions`, `UseReviewCompletionResult` from `./use-review-completion.js`.
- [x] T016 [US3] Build shared packages: run `pnpm --filter @diffgazer/core build && pnpm --filter @diffgazer/api build`. Fix any type errors in the new shared hooks or lifecycle helpers.
- [x] T017 [US3] Update `apps/web/src/features/review/hooks/use-review-lifecycle.ts` to import and use `useReviewStart` and `useReviewCompletion` from `@diffgazer/api/hooks`. Import `isNoDiffError`, `isCheckingForChanges`, `getLoadingMessage` from `@diffgazer/core/review`. Remove all local start/completion logic. Wire shared `useReviewStart` with web-specific options (`reviewId` from URL params, `onNotFoundInSession` for SESSION_NOT_FOUND). Wire shared `useReviewCompletion` with `onComplete` callback that pushes `{ issues, reviewId }` to the parent page.
- [x] T018 [US3] Delete `apps/web/src/features/review/hooks/use-review-start.ts` (replaced by shared). If `apps/web/src/features/review/hooks/use-review-completion.ts` exists as a separate file, delete it too. Update barrel exports in `apps/web/src/features/review/hooks/index.ts` if it exists.
- [x] T019 [US3] Update `apps/cli/src/features/review/hooks/use-review-lifecycle.ts` to import and use `useReviewStart` and `useReviewCompletion` from `@diffgazer/api/hooks`. Import `isNoDiffError`, `isCheckingForChanges`, `getLoadingMessage` from `@diffgazer/core/review`. Remove all local start/completion logic. Wire shared `useReviewStart` without `reviewId` (CLI has no URL params). Wire shared `useReviewCompletion` with `onComplete: () => setPhase("summary")`.
- [x] T020 [US3] Delete `apps/cli/src/features/review/hooks/use-review-start.ts` and `apps/cli/src/features/review/hooks/use-review-completion.ts` (replaced by shared). Update any barrel exports.
- [x] T021 [US3] Full build and type-check: run `pnpm build && pnpm type-check`. Fix any errors across the monorepo.
- [x] T022 [US3] Verify both apps still work after consolidation: run web review and CLI review end-to-end (same as T006 and T011). Confirm both apps import `useReviewStart` and `useReviewCompletion` from `@diffgazer/api/hooks`.

**Checkpoint**: Both apps use shared hooks. Zero duplication of start/completion logic. Both review flows work.

---

## Phase 5: User Story 4 - Shared Display Logic Reconciled (Priority: P3)

**Goal**: Document the intentional divergence in display utilities. Ensure the "shared" display.ts is correctly scoped.

**Independent Test**: Verify no app imports display functions from the wrong scope.

### Implementation for User Story 4

- [x] T023 [P] [US4] Add JSDoc comment to `packages/core/src/review/display.ts` documenting that `mapStepStatus` uses CLI naming conventions (`"running"` / `"complete"` / `"error"`) which differ from web's schema-aligned names (`"active"` / `"completed"` / `"pending"`). Document that the web has its own `mapStepStatus` in `review-container.utils.ts` because it maps to a 3-value `ProgressStatus` type with no error variant. This is intentional, not a duplication bug.
- [x] T024 [P] [US4] Verify that `apps/web/src/features/review/components/review-container.utils.ts` does NOT import from `@diffgazer/core/review/display` and has its own `mapStepStatus` and `getSubstepDetail`. Verify that `apps/cli/src/features/review/` DOES import from `@diffgazer/core/review` for `mapStepStatus` and `getAgentDetail`. Confirm no cross-contamination.

**Checkpoint**: Display logic divergence is documented. No accidental wrong imports.

---

## Phase 6: User Story 5 - Quality Audit Cleanup (Priority: P3)

**Goal**: Remove dead code, verify quality standards, ensure no regressions.

**Independent Test**: `pnpm build && pnpm type-check` passes. No dead code in review feature area.

### Implementation for User Story 5

- [x] T025 [P] [US5] Delete `apps/cli/src/app/screens/status-screen.tsx` (dead code -- not registered in CLI router, never imported). Verify with grep that no file imports or references `StatusScreen` or `status-screen`.
- [x] T026 [P] [US5] Audit all effect dependency arrays in review hooks across both apps. Verify zero unstable function references (all callback props stored in refs, not in dep arrays). Check files: `packages/api/src/hooks/use-review-start.ts`, `packages/api/src/hooks/use-review-completion.ts`, `apps/web/src/features/review/hooks/use-review-lifecycle.ts`, `apps/cli/src/features/review/hooks/use-review-lifecycle.ts`.
- [x] T027 [P] [US5] Verify barrel exports are complete and consistent: check `packages/api/src/hooks/index.ts` exports all new hooks and types. Check `packages/core/src/review/index.ts` exports lifecycle helpers. Run `pnpm type-check` to confirm no missing exports.
- [x] T028 [US5] Run `pnpm build && pnpm type-check` as final quality gate. All packages build. Zero type errors.

**Checkpoint**: Zero dead code. Zero unstable deps. All exports clean.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Final verification across all stories

- [x] T029 Run quickstart.md verification steps: build all, type-check, start web and run review, start CLI and run review, test stale session in web, test same-mode restart in CLI, verify shared imports.
- [x] T030 Update `apps/web/src/features/review/hooks/index.ts` and `apps/cli/src/features/review/hooks/index.ts` barrel files (if they exist) to remove deleted hooks and add any new re-exports.
- [x] T031 Update `.claude/docs/shared-hooks.md` to document the new shared `useReviewStart` and `useReviewCompletion` hooks: add them to the architecture diagram, document their options/return types, add them to the "How to Add a New Hook" patterns, update the invalidation map if relevant.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Foundational (Phase 1)**: No dependencies -- start immediately. BLOCKS Phases 2 and 3.
- **US1 Web Fix (Phase 2)**: Depends on Phase 1 (T001-T002 must complete)
- **US2 CLI Fix (Phase 3)**: Depends on Phase 1 (T001-T002 must complete)
- **US1 and US2 are INDEPENDENT**: Can run in parallel after Phase 1
- **US3 Consolidation (Phase 4)**: Depends on Phase 2 AND Phase 3 (both apps must be working before consolidation)
- **US4 Display (Phase 5)**: Independent -- can run any time after Phase 1
- **US5 Quality (Phase 6)**: Depends on Phase 4 (audit after consolidation)
- **Polish (Phase 7)**: Depends on all previous phases

### User Story Dependencies

```
Phase 1 (Foundational)
    |
    +---> Phase 2 (US1: Web Fix) ---+
    |                                |
    +---> Phase 3 (US2: CLI Fix) ---+--> Phase 4 (US3: Consolidation) --> Phase 6 (US5: Quality)
    |                                                                          |
    +---> Phase 5 (US4: Display) ----+                                         |
                                     +--> Phase 7 (Polish) <-------------------+
```

### Within Each User Story

- Fix core logic before fixing deps/stability
- Integration tasks depend on fix tasks
- Verification is always the last task in a story

### Parallel Opportunities

**After Phase 1 completes** (T001-T002):
- US1 (T003-T006) and US2 (T007-T011) can run in FULL PARALLEL
- US4 (T023-T024) can also run in parallel with US1/US2

**Within Phase 4** (US3):
- T012, T013, T014 can all run in PARALLEL (different files, no deps)
- T017 and T019 can run in PARALLEL (web and CLI lifecycle updates)
- T018 and T020 can run in PARALLEL (web and CLI deletions)

**Within Phase 6** (US5):
- T025, T026, T027 can all run in PARALLEL

---

## Parallel Example: Phase 1 Complete -> Launch US1 + US2

```
# After T001-T002 complete, launch in parallel:

Agent 1 (US1 - Web Fix):
  T003 -> T004 -> T005 [P with T003/T004] -> T006

Agent 2 (US2 - CLI Fix):
  T007 -> T008 -> T009 -> T010 [P with T007-T009] -> T011

Agent 3 (US4 - Display):
  T023 [P] + T024 [P]
```

## Parallel Example: US3 Consolidation

```
# After US1 and US2 complete, launch shared hook creation in parallel:

Agent 1: T012 (lifecycle-helpers.ts in core)
Agent 2: T013 (use-review-start.ts in api/hooks)
Agent 3: T014 (use-review-completion.ts in api/hooks)

# Then sequentially:
T015 (barrel exports) -> T016 (build) -> T017 + T019 (web + CLI lifecycle, parallel) -> T018 + T020 (deletions, parallel) -> T021 (build) -> T022 (verify)
```

---

## Implementation Strategy

### MVP First (US1 + US2 Only)

1. Complete Phase 1: Foundational (T001-T002)
2. Complete Phase 2: US1 Web Fix (T003-T006) -- in parallel with:
3. Complete Phase 3: US2 CLI Fix (T007-T011)
4. **STOP and VALIDATE**: Both review flows work end-to-end
5. This is the MVP -- both apps functional again

### Full Delivery

1. MVP (above)
2. Add US3 Consolidation (T012-T022) -- eliminates duplication
3. Add US4 Display docs (T023-T024) -- quality documentation
4. Add US5 Quality audit (T025-T028) -- cleanup
5. Polish (T029-T031) -- final verification + docs update

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- React Compiler is NOT active -- all function stability must be manual (ref-based pattern)
- The `useCallback`/`useMemo` convention says "don't use them" -- use refs instead for stable callbacks
- US1 and US2 are both P1 but independent; run in parallel for fastest fix
- US3 consolidation should only happen AFTER both apps are confirmed working
- See contracts/shared-review-hooks.md for exact interface specifications
