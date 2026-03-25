# Tasks: Fix Persistent Web Review Regression & Hooks Validation

**Input**: Design documents from `/specs/011-fix-review-validate-hooks/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, quickstart.md

**Tests**: Not explicitly requested. Test file `use-review-start.test.ts` already updated in 010. No new test tasks generated.

**Organization**: Tasks grouped by user story. US1 is the MVP — fixes the broken web review.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup

**Purpose**: No setup needed — all changes are within existing files in existing packages.

*(Phase skipped — no project initialization required)*

---

## Phase 2: Foundational (Shared Hook Change)

**Purpose**: The `useReviewContext` hook must accept an `enabled` option before the web consumer can use it. This blocks US1.

- [x] T001 Add `options?: { enabled?: boolean }` parameter to `useReviewContext` in `packages/api/src/hooks/review.ts` — spread options into useQuery call (same pattern as `useOpenRouterModels` on line 27)

**Checkpoint**: Shared hook accepts `enabled` option. No consumer behavior changes yet (callers without options get default behavior).

---

## Phase 3: User Story 1 — Web Review Displays Full Streaming Pipeline (Priority: P1)

**Goal**: Fix the web review so it shows step indicators, agent cards, and activity log during streaming — not project context descriptions.

**Independent Test**: Start `pnpm dev`, navigate to `/review`, trigger "Review Changes" with staged changes. Verify streaming UI renders with progress steps, agent cards, and live activity log.

### Implementation for User Story 1

- [x] T002 [US1] Add lifecycle-aware context fetch guard in `apps/web/src/features/review/components/review-container.tsx` — find context step from `state.steps`, compute `contextReady = contextStep?.status === 'completed' && !!state.reviewId`, pass `{ enabled: contextReady }` to `useReviewContext()`, derive `contextSnapshot` from `contextReady` flag instead of `state.isStreaming`
- [x] T003 [P] [US1] Add platform-aware rAF event batching in `packages/api/src/hooks/use-review-stream.ts` — add `eventQueueRef` and `rafIdRef` refs, create `flushEvents` function that batch-dispatches queued events, modify `dispatchEvent` to: (a) dispatch `review_started` events immediately, (b) queue other events and schedule rAF flush in browser, (c) flush synchronously in Node.js (`typeof requestAnimationFrame === 'undefined'`), add cleanup in useEffect to cancel rAF and flush remaining events on unmount
- [x] T004 [US1] Verify web review end-to-end — run `pnpm run type-check`, run `pnpm build`, run `cd apps/web && pnpm test`, start `pnpm dev` and manually verify: (1) fresh review shows streaming UI with steps/agents/log, (2) stale session falls back to fresh start, (3) context snapshot appears only after context step completes, (4) completion fires only after real results

**Checkpoint**: Web review works — streaming UI shows lenses, agents, progress. Context descriptions appear only after context step completes. rAF batching reduces re-renders during streaming.

---

## Phase 4: User Story 2 — CLI Review Flow Works Identically (Priority: P1)

**Goal**: Verify the CLI review flow has no issues after the shared hook changes.

**Independent Test**: Run `pnpm dev:cli`, navigate to review, select a mode, verify streaming renders correctly.

### Implementation for User Story 2

- [x] T005 [US2] Verify CLI review flow after shared hook changes — run `pnpm run type-check` (CLI app), start `pnpm dev:cli`, trigger a review, verify: (1) streaming progress renders in terminal, (2) agent output appears, (3) summary shows after completion, (4) rAF batching falls back to synchronous dispatch in Node.js (no `requestAnimationFrame` in Ink)

**Checkpoint**: CLI review works correctly. rAF batching has no effect in Node.js (synchronous fallback).

---

## Phase 5: User Story 3 — Hooks Quality Meets Production Standards (Priority: P2)

**Goal**: Fix 2 hooks quality warnings (unused type exports). Validate matchQueryState adoption.

**Independent Test**: Grep for `ReviewStreamState` and `ServerState` imports across both apps — should find zero consumers. Count matchQueryState consumers — should be 12+.

### Implementation for User Story 3

- [x] T006 [P] [US3] Remove unused `ReviewStreamState` type export from barrel in `packages/api/src/hooks/index.ts` — change line 28 from `export { useReviewStream, type ReviewStreamState }` to `export { useReviewStream }` from `"./use-review-stream.js"`
- [x] T007 [P] [US3] Remove unused `ServerState` type export from barrel in `packages/api/src/hooks/index.ts` — change line 26 from `export { useServerStatus, type ServerState, useShutdown }` to `export { useServerStatus, useShutdown }` from `"./server.js"`
- [x] T008 [US3] Verify no consumer imports `ReviewStreamState` or `ServerState` from `@diffgazer/api/hooks` — grep across apps/cli and apps/web, run `pnpm run type-check` to confirm no compile errors

**Checkpoint**: Hooks barrel exports only used types. Quality warnings resolved. matchQueryState validated (12 consumers, all correct, no changes needed).

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final verification across all packages.

- [x] T009 Run full build and type-check — `pnpm run type-check && pnpm build`
- [x] T010 Run all test suites — `cd apps/web && pnpm test` (verify use-review-start.test.ts passes)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Foundational (Phase 2)**: No dependencies — can start immediately
- **US1 (Phase 3)**: T002 depends on T001 (needs `enabled` option). T003 is independent. T004 depends on T002 + T003.
- **US2 (Phase 4)**: Depends on T003 (rAF batching change affects shared hook used by CLI)
- **US3 (Phase 5)**: No dependencies on US1/US2 — can run in parallel
- **Polish (Phase 6)**: Depends on all phases completing

### User Story Dependencies

- **US1 (P1)**: Depends on T001 (foundational). **This is the MVP.**
- **US2 (P1)**: Depends on T003 (shared hook rAF change). Can verify after T003 completes.
- **US3 (P2)**: Independent — can run in parallel with US1/US2.

### Parallel Opportunities

- T003 and T001 can run in parallel (different files: `use-review-stream.ts` vs `review.ts`)
- T006 and T007 can run in parallel (same file but independent line changes, or batch together)
- US3 can run in parallel with US1/US2 (different files, no dependencies)

---

## Parallel Example: US1

```bash
# Launch foundational + rAF batching in parallel (different files):
Agent 1: "T001 — Add enabled option to useReviewContext in packages/api/src/hooks/review.ts"
Agent 2: "T003 — Add rAF batching in packages/api/src/hooks/use-review-stream.ts"

# After both complete, apply the web consumer fix:
Agent 3: "T002 — Add lifecycle guard in apps/web/src/features/review/components/review-container.tsx"

# Then verify:
Agent 4: "T004 — Type-check, build, test, manual verification"
```

## Parallel Example: Maximum Parallelism

```bash
# Wave 1 (3 agents, all independent files):
Agent 1: "T001 — useReviewContext enabled option (packages/api/src/hooks/review.ts)"
Agent 2: "T003 — rAF batching (packages/api/src/hooks/use-review-stream.ts)"
Agent 3: "T006 + T007 — Remove unused exports (packages/api/src/hooks/index.ts)"

# Wave 2 (after Wave 1):
Agent 4: "T002 — Lifecycle guard (apps/web/src/features/review/components/review-container.tsx)"

# Wave 3 (verification, after all code changes):
Agent 5: "T004 + T005 + T008 + T009 + T010 — Full verification"
```

---

## Implementation Strategy

### MVP First (US1 Only)

1. Complete T001 (foundational — `enabled` option)
2. Complete T002 + T003 (fix context timing + rAF batching)
3. **STOP and VALIDATE**: T004 — verify web review works end-to-end
4. The web review is fixed. Ship it.

### Incremental Delivery

1. T001 + T002 + T003 → T004 → **Web review fixed** (MVP!)
2. T005 → **CLI verified**
3. T006 + T007 + T008 → **Hooks quality clean**
4. T009 + T010 → **Full verification**

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story
- T001 is the only blocking foundational task (T002 needs it, others don't)
- T003 (rAF batching) is the highest-risk change — test thoroughly
- No new files created — all changes within existing files
- No documentation changes needed (docs verified 100% accurate)
- matchQueryState validated as sound — no changes needed (12 consumers, all correct)
