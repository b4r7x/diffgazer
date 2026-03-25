# Tasks: Shared API Hooks Consolidation

**Input**: Design documents from `/specs/008-hooks-consolidation/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md

**Tests**: Not requested. No test tasks generated.

**Organization**: Tasks grouped by user story. US1+US3 are independent and can run in parallel. US2 depends on both completing. US4 depends on US2.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: User Story 1 - Remove Dead Code (Priority: P1) + User Story 3 - Rename Query Files (Priority: P2)

**Purpose**: These two stories are independent (US1 deletes hook files, US3 renames query factory files). Running them in parallel reduces the total file set before consolidation in Phase 2.

### US1: Remove Dead Code

**Goal**: Delete 6 unused hooks and 4 unused query factory re-exports from the public API surface.

**Independent Test**: Both CLI and web apps build and pass all tests after removal. Zero imports of removed hooks exist in consumer code.

- [x] T001 [P] [US1] Delete unused query hook files: `packages/api/src/hooks/use-trust.ts`, `packages/api/src/hooks/use-trusted-projects.ts`, `packages/api/src/hooks/use-git-status.ts`, `packages/api/src/hooks/use-git-diff.ts`
- [x] T002 [P] [US1] Delete unused mutation hook files: `packages/api/src/hooks/use-run-drilldown.ts`, `packages/api/src/hooks/use-delete-config.ts`
- [x] T003 [US1] Remove exports of deleted hooks from barrel in `packages/api/src/hooks/index.ts`: remove `useTrust`, `useTrustedProjects`, `useGitStatus`, `useGitDiff`, `useRunDrilldown`, `useDeleteConfig`
- [x] T004 [US1] Remove unused query factory re-exports from barrel in `packages/api/src/hooks/index.ts`: remove `reviewQueries`, `serverQueries`, `trustQueries`, `gitQueries` from the "Query factories" export line. Keep only `configQueries`
- [x] T005 [US1] Build `@diffgazer/api` package and verify no errors: `pnpm --filter @diffgazer/api build`
- [x] T006 [US1] Build both consumer apps and verify no import errors: `pnpm build`

### US3: Rename Query Factory Files

**Goal**: Remove redundant `.queries` suffix from all query factory files in the `queries/` directory.

**Independent Test**: Package builds successfully with renamed files. All internal imports resolve correctly.

- [x] T007 [P] [US3] Rename `packages/api/src/hooks/queries/config.queries.ts` to `packages/api/src/hooks/queries/config.ts`
- [x] T008 [P] [US3] Rename `packages/api/src/hooks/queries/review.queries.ts` to `packages/api/src/hooks/queries/review.ts`
- [x] T009 [P] [US3] Rename `packages/api/src/hooks/queries/server.queries.ts` to `packages/api/src/hooks/queries/server.ts`
- [x] T010 [P] [US3] Rename `packages/api/src/hooks/queries/trust.queries.ts` to `packages/api/src/hooks/queries/trust.ts`
- [x] T011 [P] [US3] Rename `packages/api/src/hooks/queries/git.queries.ts` to `packages/api/src/hooks/queries/git.ts`
- [x] T012 [US3] Update `packages/api/src/hooks/queries/index.ts` to import from renamed files (drop `.queries` from all import paths)
- [x] T013 [US3] Update all remaining `use-*.ts` hook files that import from `./queries/*.queries.js` to import from `./queries/*.js` instead. Files to update: `use-settings.ts`, `use-init.ts`, `use-config-check.ts`, `use-provider-status.ts`, `use-openrouter-models.ts`, `use-save-settings.ts`, `use-save-config.ts`, `use-activate-provider.ts`, `use-delete-provider-credentials.ts`, `use-reviews.ts`, `use-review.ts`, `use-active-review-session.ts`, `use-review-context.ts`, `use-delete-review.ts`, `use-refresh-review-context.ts`, `use-save-trust.ts`, `use-delete-trust.ts`, `use-server-status.ts`, `use-shutdown.ts`, `use-review-stream.ts`
- [x] T014 [US3] Build `@diffgazer/api` package and verify no errors: `pnpm --filter @diffgazer/api build`

**Checkpoint**: After Phase 1, 6 unused hooks are removed, 5 query files are renamed, and all builds pass. The hooks directory still has many files but is cleaner.

---

## Phase 2: User Story 2 - Consolidate Hook Files by Domain (Priority: P1)

**Goal**: Merge remaining ~19 single-hook files into ~4 domain-grouped files, reducing file count by ~65%.

**Independent Test**: All existing imports from `@diffgazer/api/hooks` continue to work unchanged. Both apps build and pass all tests. The public API (hook names, signatures, types) is identical.

**⚠️ Depends on**: Phase 1 completion (US1 + US3) -- dead hooks removed and query files renamed before consolidation.

### Consolidation Tasks (parallelizable by domain)

- [x] T015 [P] [US2] Create `packages/api/src/hooks/config.ts` consolidating all config hooks. Move into this single file: `useSettings` (from `use-settings.ts`), `useInit` (from `use-init.ts`), `useConfigCheck` (from `use-config-check.ts`), `useProviderStatus` (from `use-provider-status.ts`), `useOpenRouterModels` (from `use-openrouter-models.ts`), `useSaveSettings` (from `use-save-settings.ts`), `useSaveConfig` (from `use-save-config.ts`), `useActivateProvider` (from `use-activate-provider.ts`), `useDeleteProviderCredentials` (from `use-delete-provider-credentials.ts`). Import `configQueries` from `./queries/config.js`. Export all 9 hooks.
- [x] T016 [P] [US2] Create `packages/api/src/hooks/review.ts` consolidating all review hooks (NOT the streaming hook). Move into this single file: `useReviews` (from `use-reviews.ts`), `useReview` (from `use-review.ts`), `useActiveReviewSession` (from `use-active-review-session.ts`), `useReviewContext` (from `use-review-context.ts`), `useDeleteReview` (from `use-delete-review.ts`), `useRefreshReviewContext` (from `use-refresh-review-context.ts`). Import `reviewQueries` from `./queries/review.js`. Export all 6 hooks.
- [x] T017 [P] [US2] Create `packages/api/src/hooks/trust.ts` consolidating trust hooks. Move into this single file: `useSaveTrust` (from `use-save-trust.ts`), `useDeleteTrust` (from `use-delete-trust.ts`). Import `trustQueries` and `configQueries` from `./queries/*.js`. Export both hooks.
- [x] T018 [P] [US2] Create `packages/api/src/hooks/server.ts` consolidating server hooks. Move into this single file: `useServerStatus` (from `use-server-status.ts`, including `ServerState` type), `useShutdown` (from `use-shutdown.ts`). Import `serverQueries` from `./queries/server.js`. Export both hooks and the `ServerState` type.

### Cleanup Tasks (sequential, after consolidation)

- [x] T019 [US2] Delete all original single-hook `use-*.ts` files that were consolidated into domain files. Files to delete: `use-settings.ts`, `use-init.ts`, `use-config-check.ts`, `use-provider-status.ts`, `use-openrouter-models.ts`, `use-save-settings.ts`, `use-save-config.ts`, `use-activate-provider.ts`, `use-delete-provider-credentials.ts`, `use-reviews.ts`, `use-review.ts`, `use-active-review-session.ts`, `use-review-context.ts`, `use-delete-review.ts`, `use-refresh-review-context.ts`, `use-save-trust.ts`, `use-delete-trust.ts`, `use-server-status.ts`, `use-shutdown.ts`
- [x] T020 [US2] Remove `packages/api/src/hooks/queries/index.ts` barrel file (no longer needed -- domain files import query factories directly)
- [x] T021 [US2] Rewrite `packages/api/src/hooks/index.ts` barrel to re-export from new domain files instead of individual hook files. Structure: context.ts exports, config.ts exports, review.ts exports, trust.ts exports, server.ts exports, use-review-stream.ts exports, configQueries from queries/config.js
- [x] T022 [US2] Build `@diffgazer/api` package: `pnpm --filter @diffgazer/api build`
- [x] T023 [US2] Build both consumer apps: `pnpm build`
- [x] T024 [US2] Run all tests: `pnpm test` (if test command exists)

**Checkpoint**: After Phase 2, the hooks directory has ~8 files instead of 28. All consumer imports work unchanged. The public API is identical.

---

## Phase 3: User Story 4 - Loading State Helper (Priority: P3)

**Goal**: Add a `matchQueryState()` utility function that maps query result state to render callbacks, reducing repetitive loading/error/empty checks in components.

**Independent Test**: At least one CLI screen and one web page use the helper, producing identical behavior with less code.

**⚠️ Depends on**: Phase 2 completion -- file structure is finalized before adding new exports.

- [x] T025 [US4] Create `packages/api/src/hooks/match-query-state.ts` with `matchQueryState<T>()` utility. Function signature: accepts `UseQueryResult<T>` and a handlers object `{ loading: () => ReactNode, error: (err: Error) => ReactNode, empty?: (data: T) => boolean, success: (data: T) => ReactNode }`. Returns `ReactNode`. When `query.isLoading` → call `loading()`. When `query.error` → call `error(query.error)`. When data exists and `empty?.(data)` returns true → call `loading()` as fallback (or a dedicated empty handler if provided). Otherwise → call `success(data)`. Import `UseQueryResult` from `@tanstack/react-query` and `ReactNode` from `react`.
- [x] T026 [US4] Add `matchQueryState` export to `packages/api/src/hooks/index.ts`
- [x] T027 [US4] Build `@diffgazer/api` package: `pnpm --filter @diffgazer/api build`
- [x] T028 [P] [US4] Demonstrate `matchQueryState` in one CLI screen by refactoring `apps/cli/src/app/screens/history-screen.tsx` (or equivalent) to replace manual `if (isLoading) ... if (error) ...` guards with `matchQueryState(query, { loading, error, success })`
- [x] T029 [P] [US4] Demonstrate `matchQueryState` in one web page by refactoring `apps/web/src/features/history/components/page.tsx` (or equivalent) to replace manual loading/error guards with `matchQueryState(query, { loading, error, success })`
- [x] T030 [US4] Build both apps and verify the refactored screens render identically: `pnpm build`

**Checkpoint**: After Phase 3, the `matchQueryState` utility is available and demonstrated in both platforms.

---

## Phase 4: Polish & Cross-Cutting Concerns

**Purpose**: Documentation updates, final verification, cleanup.

- [x] T031 Update `packages/api/src/hooks/` documentation in `.claude/docs/shared-hooks.md` to reflect new file structure: update the Architecture section (file tree), update the "How to Add a New Hook" section (hooks now go in domain files, not individual files), update the Query Key Hierarchy section (remove entries for deleted hooks), update the Invalidation Map (remove entries for deleted mutations), note the `matchQueryState` utility
- [x] T032 Verify public API surface matches pre-consolidation by comparing exported hook names: run `grep "export {" packages/api/src/hooks/index.ts` and confirm all used hooks are present
- [x] T033 Final full build of both apps: `pnpm build`
- [x] T034 Run quickstart.md validation: verify the commands and usage examples in `specs/008-hooks-consolidation/quickstart.md` work correctly

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (US1 + US3)**: No dependencies -- can start immediately. US1 and US3 are independent of each other and can run in parallel.
- **Phase 2 (US2)**: Depends on Phase 1 completion -- consolidation must happen after dead code removal and file renames.
- **Phase 3 (US4)**: Depends on Phase 2 completion -- loading utility added after file structure is finalized.
- **Phase 4 (Polish)**: Depends on all user stories being complete.

### User Story Dependencies

- **User Story 1 (P1)**: No dependencies on other stories. Deletes hook files and barrel exports.
- **User Story 3 (P2)**: No dependencies on other stories. Renames query factory files and updates imports.
- **User Story 2 (P1)**: Depends on US1 + US3 completing first (cleaner base for consolidation).
- **User Story 4 (P3)**: Depends on US2 completing (file structure finalized).

### Within Each User Story

- File renames/deletes before import updates
- Import updates before barrel rewrites
- Barrel rewrites before build verification

### Parallel Opportunities

**Phase 1** (6 parallel lanes):
- T001 + T002 (delete hooks) can run in parallel
- T007 + T008 + T009 + T010 + T011 (rename queries) can run in parallel
- US1 tasks and US3 tasks are independent of each other

**Phase 2** (4 parallel lanes):
- T015 + T016 + T017 + T018 (create domain files) can all run in parallel

**Phase 3** (2 parallel lanes):
- T028 + T029 (demo in CLI + web) can run in parallel

---

## Parallel Example: Phase 1

```bash
# Launch US1 dead code removal and US3 file renames together:
Agent 1: "Delete unused hook files use-trust.ts, use-trusted-projects.ts, use-git-status.ts, use-git-diff.ts"
Agent 2: "Delete unused hook files use-run-drilldown.ts, use-delete-config.ts"
Agent 3: "Rename config.queries.ts to config.ts in packages/api/src/hooks/queries/"
Agent 4: "Rename review.queries.ts to review.ts in packages/api/src/hooks/queries/"
Agent 5: "Rename server.queries.ts to server.ts in packages/api/src/hooks/queries/"
Agent 6: "Rename trust.queries.ts to trust.ts in packages/api/src/hooks/queries/"
Agent 7: "Rename git.queries.ts to git.ts in packages/api/src/hooks/queries/"
```

## Parallel Example: Phase 2

```bash
# Launch domain consolidation tasks together:
Agent 1: "Create config.ts with all 9 config hooks consolidated"
Agent 2: "Create review.ts with all 6 review hooks consolidated"
Agent 3: "Create trust.ts with 2 trust mutation hooks consolidated"
Agent 4: "Create server.ts with server status + shutdown hooks consolidated"
```

---

## Implementation Strategy

### MVP First (User Story 1 + 3)

1. Complete Phase 1: Remove dead code + rename files
2. **STOP and VALIDATE**: Both apps build, no import errors
3. This alone delivers value: cleaner API surface, better naming

### Incremental Delivery

1. Phase 1 (US1 + US3) → Dead code removed, files renamed → Build passes
2. Phase 2 (US2) → Hooks consolidated by domain → Build passes, 71% fewer files
3. Phase 3 (US4) → Loading helper added + demonstrated → Build passes
4. Phase 4 (Polish) → Docs updated, final verification

### Parallel Agent Strategy

With parallel agents:

- **Phase 1**: 7 agents (2 for deletes, 5 for renames), then 2 agents for import updates, then 1 for builds
- **Phase 2**: 4 agents (one per domain), then 1 agent for cleanup + barrel + builds
- **Phase 3**: 1 agent for utility, then 2 agents for demos, then 1 for builds
- **Phase 4**: 1 agent for docs + verification

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- No tests requested -- test tasks omitted
- All backend endpoints remain untouched (FR-011)
- `use-review-stream.ts` is NOT consolidated -- kept as its own file (FR-010)
- Consumer apps require ZERO import changes -- barrel export preserves all used hook names
