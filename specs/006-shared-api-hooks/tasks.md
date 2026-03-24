# Tasks: Shared API Hooks & Unified Data Fetching

**Input**: Design documents from `/specs/006-shared-api-hooks/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/hooks-api.md

**Tests**: Not explicitly requested in spec. Test tasks omitted.

**Organization**: Tasks grouped by user story to enable independent implementation.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup

**Purpose**: Install TanStack Query, create directory structure, configure package exports

- [X] T001 Install `@tanstack/react-query` v5 as peerDependency in `packages/api/package.json` and add React as peerDependency
- [X] T002 Add `"./hooks"` subpath export to `packages/api/package.json` pointing to `dist/hooks/index.js` (types + import)
- [X] T003 Create hooks directory structure in `packages/api/src/hooks/` with subdirectories: `queries/`
- [X] T004 Update `packages/api/tsconfig.json` to include `src/hooks/` in compilation

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: ApiProvider context and query key factories — MUST complete before hooks can be created

- [X] T005 Create `ApiProvider` context and `useApi` hook in `packages/api/src/hooks/context.ts` per contract (throws if missing)
- [X] T006 [P] Create `configQueries` factory using `queryOptions()` in `packages/api/src/hooks/queries/config.queries.ts` (settings, init, check, providers, openRouterModels)
- [X] T007 [P] Create `reviewQueries` factory using `queryOptions()` in `packages/api/src/hooks/queries/review.queries.ts` (list, detail, activeSession, context)
- [X] T008 [P] Create `serverQueries` factory in `packages/api/src/hooks/queries/server.queries.ts` (health with refetchInterval: 30s)
- [X] T009 [P] Create `trustQueries` factory in `packages/api/src/hooks/queries/trust.queries.ts` (single, list)
- [X] T010 [P] Create `gitQueries` factory in `packages/api/src/hooks/queries/git.queries.ts` (status, diff)
- [X] T011 Create queries barrel export in `packages/api/src/hooks/queries/index.ts`

**Checkpoint**: Foundation ready — shared hooks can now be implemented in parallel

---

## Phase 3: User Story 1 + 2 — Shared Query Hooks (Priority: P1+P2) 🎯 MVP

**Goal**: Create all 14 shared query hooks using TanStack Query's `useQuery`, eliminating hand-rolled loading/error state patterns

**Independent Test**: Import `useSettings` in a test component wrapped in `QueryClientProvider` + `ApiProvider`, verify it returns `{ data, isLoading, error, refetch }` and calls `api.getSettings()`

### Config Domain Query Hooks

- [X] T012 [P] [US1] Create `useSettings` hook in `packages/api/src/hooks/use-settings.ts` — wraps `configQueries.settings`, returns `UseQueryResult<SettingsConfig>`
- [X] T013 [P] [US1] Create `useInit` hook in `packages/api/src/hooks/use-init.ts` — wraps `configQueries.init`, returns `UseQueryResult<InitResponse>`
- [X] T014 [P] [US1] Create `useConfigCheck` hook in `packages/api/src/hooks/use-config-check.ts` — wraps `configQueries.check`, returns `UseQueryResult<ConfigCheckResponse>`
- [X] T015 [P] [US1] Create `useProviderStatus` hook in `packages/api/src/hooks/use-provider-status.ts` — wraps `configQueries.providers`, returns `UseQueryResult<ProviderStatus[]>`
- [X] T016 [P] [US1] Create `useOpenRouterModels` hook in `packages/api/src/hooks/use-openrouter-models.ts` — wraps `configQueries.openRouterModels`, accepts `{ enabled }` option

### Review Domain Query Hooks

- [X] T017 [P] [US1] Create `useReviews` hook in `packages/api/src/hooks/use-reviews.ts` — wraps `reviewQueries.list(api, projectPath?)`, staleTime 0
- [X] T018 [P] [US1] Create `useReview` hook in `packages/api/src/hooks/use-review.ts` — wraps `reviewQueries.detail(api, id)`, enabled when id is truthy
- [X] T019 [P] [US1] Create `useActiveReviewSession` hook in `packages/api/src/hooks/use-active-review-session.ts` — wraps `reviewQueries.activeSession(api, mode?)`
- [X] T020 [P] [US1] Create `useReviewContext` hook in `packages/api/src/hooks/use-review-context.ts` — wraps `reviewQueries.context`

### Server, Trust, Git Domain Query Hooks

- [X] T021 [P] [US1] Create `useServerStatus` hook in `packages/api/src/hooks/use-server-status.ts` — wraps `serverQueries.health`, refetchInterval 30000
- [X] T022 [P] [US1] Create `useTrust` hook in `packages/api/src/hooks/use-trust.ts` — wraps `trustQueries.single(api, projectId)`
- [X] T023 [P] [US1] Create `useTrustedProjects` hook in `packages/api/src/hooks/use-trusted-projects.ts` — wraps `trustQueries.list`
- [X] T024 [P] [US1] Create `useGitStatus` hook in `packages/api/src/hooks/use-git-status.ts` — wraps `gitQueries.status(api, path?)`
- [X] T025 [P] [US1] Create `useGitDiff` hook in `packages/api/src/hooks/use-git-diff.ts` — wraps `gitQueries.diff(api, mode?, path?)`

**Checkpoint**: All 14 query hooks created — data fetching is shareable

---

## Phase 4: User Story 1 + 2 — Shared Mutation Hooks (Priority: P1+P2)

**Goal**: Create all 11 shared mutation hooks using TanStack Query's `useMutation` with automatic cache invalidation

**Independent Test**: Call `useSaveSettings().mutate({ theme: 'dark' })`, verify it calls `api.saveSettings()` and invalidates `['config', 'settings']` query

### Config Domain Mutations

- [X] T026 [P] [US1] Create `useSaveSettings` mutation in `packages/api/src/hooks/use-save-settings.ts` — invalidates `['config', 'settings']`
- [X] T027 [P] [US1] Create `useSaveConfig` mutation in `packages/api/src/hooks/use-save-config.ts` — invalidates all `['config']`
- [X] T028 [P] [US1] Create `useActivateProvider` mutation in `packages/api/src/hooks/use-activate-provider.ts` — invalidates `['config', 'providers']` + `['config', 'init']`
- [X] T029 [P] [US1] Create `useDeleteProviderCredentials` mutation in `packages/api/src/hooks/use-delete-provider-credentials.ts` — invalidates all `['config']`
- [X] T030 [P] [US1] Create `useDeleteConfig` mutation in `packages/api/src/hooks/use-delete-config.ts` — invalidates all `['config']`

### Trust Domain Mutations

- [X] T031 [P] [US1] Create `useSaveTrust` mutation in `packages/api/src/hooks/use-save-trust.ts` — invalidates `['trust']` + `['config', 'init']`
- [X] T032 [P] [US1] Create `useDeleteTrust` mutation in `packages/api/src/hooks/use-delete-trust.ts` — invalidates `['trust']` + `['config', 'init']`

### Review Domain Mutations

- [X] T033 [P] [US1] Create `useDeleteReview` mutation in `packages/api/src/hooks/use-delete-review.ts` — invalidates `['reviews']`, removes `['review', id]`
- [X] T034 [P] [US1] Create `useRefreshReviewContext` mutation in `packages/api/src/hooks/use-refresh-review-context.ts` — invalidates `['review', 'context']`
- [X] T035 [P] [US1] Create `useRunDrilldown` mutation in `packages/api/src/hooks/use-run-drilldown.ts` — invalidates `['review', reviewId]`
- [X] T036 [P] [US1] Create `useShutdown` mutation in `packages/api/src/hooks/use-shutdown.ts` — fire-and-forget, no cache invalidation

**Checkpoint**: All 11 mutation hooks created — writes are shareable with auto cache invalidation

---

## Phase 5: User Story 1 — Shared Streaming Hook + Barrel Export (Priority: P1)

**Goal**: Extract the streaming review hook and create the barrel export for the entire hooks package

- [X] T037 [US1] Create shared `useReviewStream` hook in `packages/api/src/hooks/use-review-stream.ts` — useReducer-based (NOT TanStack Query), extends `reviewReducer` from `@diffgazer/core/review`, accepts optional `batchEvents` callback for platform-specific event batching, manages AbortController
- [X] T038 [US1] Create barrel export in `packages/api/src/hooks/index.ts` — re-export all query hooks, mutation hooks, streaming hook, ApiProvider, useApi, and all query factories
- [X] T039 [US1] Build `@diffgazer/api` package and verify `./hooks` subpath export works (`pnpm --filter @diffgazer/api build && pnpm --filter @diffgazer/api type-check`)

**Checkpoint**: `@diffgazer/api/hooks` is fully built and importable — shared hook library is ready

---

## Phase 6: User Story 3 — Wire TanStack Query in CLI (Ink) (Priority: P2)

**Goal**: Configure TanStack Query for Node.js terminal environment and wire up providers in CLI app root

**Independent Test**: Run CLI app in terminal, verify no browser API errors, queries execute normally

- [X] T040 [US3] Create CLI QueryClient factory with terminal config (`networkMode: 'always'`, `refetchOnWindowFocus: false`, `refetchOnReconnect: false`, `retry: 1`, `staleTime: 30_000`) in `apps/cli/src/lib/query-client.ts`
- [X] T041 [US3] Wrap CLI app root in `QueryClientProvider` + `ApiProvider` in `apps/cli/src/app/index.tsx` — pass existing `api` singleton from `apps/cli/src/lib/api.ts`
- [X] T042 [US3] Verify CLI app starts without browser API errors (no `window`, `document`, `navigator` references at runtime)

---

## Phase 7: User Story 2 — Wire TanStack Query in Web App (Priority: P2)

**Goal**: Configure TanStack Query for browser and wire up providers in web app root

**Independent Test**: Run web app, verify existing functionality works with TanStack Query providers in place

- [X] T043 [US2] Create web QueryClient factory with browser config (`staleTime: 60_000`, `retry: 2`) in `apps/web/src/lib/query-client.ts`
- [X] T044 [US2] Wrap web app root in `QueryClientProvider` + `ApiProvider` in `apps/web/src/app/routes/__root.tsx` — pass existing `api` singleton from `apps/web/src/lib/api.ts`

**Checkpoint**: Both apps have TanStack Query + ApiProvider wired — shared hooks can now be consumed

---

## Phase 8: User Story 1 — Migrate CLI to Shared Hooks (Priority: P1)

**Goal**: Replace all hand-rolled CLI hooks with shared hooks from `@diffgazer/api/hooks`

**Independent Test**: Run CLI app, verify all screens work identically to before migration

- [X] T045 [US1] Replace CLI `useInit` with shared `useInit` from `@diffgazer/api/hooks` — update all 7 consumer files to use `{ data, isLoading, error }` shape, delete `apps/cli/src/hooks/use-init.ts`
- [X] T046 [US1] Replace CLI `useSettings` with shared `useSettings` — update all 5 consumer files, delete `apps/cli/src/hooks/use-settings.ts`
- [X] T047 [US1] Replace CLI `useServerStatus` with shared `useServerStatus` — update `apps/cli/src/app/index.tsx`, delete `apps/cli/src/hooks/use-server-status.ts`
- [X] T048 [US1] Replace CLI `useReviewStream` with shared `useReviewStream` — update `apps/cli/src/features/review/hooks/use-review-lifecycle.ts`, delete `apps/cli/src/features/review/hooks/use-review-stream.ts`
- [X] T049 [US1] Replace inline `api.*` calls in CLI components with shared hooks — update `home-screen.tsx` (useReviews, useActiveReviewSession, useShutdown), `history-screen.tsx` (useReviews), `review-screen.tsx` (useReview), `diagnostics-screen.tsx` (useServerStatus, useReviewContext, useRefreshReviewContext)
- [X] T050 [US1] Replace inline `api.*` mutation calls in CLI settings screens with shared mutation hooks — update `storage-screen.tsx` (useSaveSettings), `trust-permissions-screen.tsx` (useSaveTrust, useDeleteTrust), `agent-execution-screen.tsx` (useSaveSettings), `analysis-screen.tsx` (useSaveSettings)
- [X] T051 [US1] Replace inline `api.*` calls in CLI onboarding with shared mutations — update `onboarding-wizard.tsx` (useSaveSettings, useSaveConfig), `provider-step.tsx`, `model-step.tsx`, `api-key-overlay.tsx` (useSaveConfig), `model-select-overlay.tsx` (useActivateProvider)
- [X] T052 [US1] Replace inline `api.*` calls in CLI trust panel with shared mutation — update `trust-panel.tsx` (useSaveTrust)

**Checkpoint**: CLI fully migrated — all API calls go through shared hooks

---

## Phase 9: User Story 1 — Migrate Web to Shared Hooks (Priority: P1)

**Goal**: Replace all hand-rolled web hooks with shared hooks from `@diffgazer/api/hooks`

**Independent Test**: Run web app, verify all pages work identically to before migration

- [X] T053 [US1] Replace web `useSettings` (module-level cache + useSyncExternalStore) with shared `useSettings` — update all consumer files, remove `invalidateSettingsCache`/`refreshSettingsCache` exports, delete `apps/web/src/hooks/use-settings.ts`
- [X] T054 [US1] Replace web `useServerStatus` with shared `useServerStatus` — update `__root.tsx` and `diagnostics/page.tsx`, delete `apps/web/src/hooks/use-server-status.ts`
- [X] T055 [US1] Replace web `useOpenRouterModels` with shared `useOpenRouterModels` — update `model-step.tsx` and `model-select-dialog.tsx`, delete `apps/web/src/hooks/use-openrouter-models.ts`
- [X] T056 [US1] Replace web `useTrust` with shared `useSaveTrust` + `useDeleteTrust` — update `trust-panel.tsx` and `trust-permissions/page.tsx`, delete `apps/web/src/hooks/use-trust.ts`
- [X] T057 [US1] Replace web `useReviews` with shared `useReviews` + `useDeleteReview` — update `use-review-history.ts` and `use-history-page.ts`, delete `apps/web/src/features/history/hooks/use-reviews.ts`
- [X] T058 [US1] Replace web `useReviewDetail` with shared `useReview` — update `use-history-page.ts`, delete `apps/web/src/features/history/hooks/use-review-detail.ts`
- [X] T059 [US1] Replace web `useReviewStream` with shared `useReviewStream` — pass rAF batching callback, update `use-review-lifecycle.ts`, delete `apps/web/src/features/review/hooks/use-review-stream.ts`
- [X] T060 [US1] Replace web `useContextSnapshot` with shared `useReviewContext` — update `review-container.tsx`, delete `apps/web/src/features/review/hooks/use-context-snapshot.ts`
- [X] T061 [US1] Replace web `useContextManagement` with shared `useReviewContext` + `useRefreshReviewContext` — update `diagnostics/page.tsx`, delete `apps/web/src/features/settings/hooks/use-context-management.ts`
- [X] T062 [US1] Replace inline `api.saveSettings()` calls in web settings pages with `useSaveSettings` mutation — update `storage/page.tsx`, `analysis/page.tsx`, `agent-execution/page.tsx`
- [X] T063 [US1] Update web `useOnboarding` to use shared `useSaveSettings` + `useSaveConfig` mutations — simplify `apps/web/src/features/onboarding/hooks/use-onboarding.ts`

**Checkpoint**: Web fully migrated — all API calls go through shared hooks

---

## Phase 10: User Story 4 — Platform-Specific Adapters (Priority: P3)

**Goal**: Simplify ConfigProvider and platform-specific hooks to thin wrappers over shared hooks

**Independent Test**: Verify ConfigProvider consumers still receive correct derived state, CLI config guard navigates to onboarding when not configured

- [X] T064 [US4] Simplify web `ConfigProvider` to compose shared hooks — replace `api.loadInit()` with `useInit()`, `api.getProviderStatus()` with `useProviderStatus()`, mutations with shared mutation hooks. Remove module-level TTL cache, remove manual isLoading/isSaving/error state. Keep split ConfigDataContext/ConfigActionsContext for render optimization. Update `apps/web/src/app/providers/config-provider.tsx`
- [X] T065 [US4] Simplify web `ThemeProvider` to use `useSaveSettings` mutation for theme persistence — update `apps/web/src/app/providers/theme-provider.tsx`
- [X] T066 [US4] Simplify CLI `useConfigGuard` to thin wrapper — use shared `useConfigCheck` for the query, keep platform-specific navigation to onboarding screen. Update `apps/cli/src/hooks/use-config-guard.ts`
- [X] T067 [US4] Simplify CLI `useReviewLifecycle` to compose shared hooks — use shared `useInit`, `useSettings`, `useActiveReviewSession`, `useReviewStream`. Keep CLI-specific phase state machine and navigation. Update `apps/cli/src/features/review/hooks/use-review-lifecycle.ts`
- [X] T068 [US4] Simplify web `useReviewLifecycle` to compose shared hooks — use shared `useActiveReviewSession`, `useReviewStream`. Keep web-specific TanStack Router navigation and URL sync. Update `apps/web/src/features/review/hooks/use-review-lifecycle.ts`
- [X] T069 [US4] Simplify web `useReviewHistory` to compose shared hooks — use shared `useReviews`, `useReview`, `useDeleteReview`. Update `apps/web/src/features/history/hooks/use-review-history.ts`
- [X] T070 [US4] Update web route guards in `apps/web/src/lib/config-guards/config-guards.ts` to use shared `configQueries` for prefetching via `queryClient.fetchQuery()`

**Checkpoint**: All platform-specific hooks simplified to thin wrappers over shared hooks

---

## Phase 11: Polish & Cross-Cutting Concerns

**Purpose**: Verification, cleanup, and final validation

- [X] T071 Build entire monorepo and verify no type errors (`pnpm build && pnpm type-check`)
- [X] T072 Run all existing tests across web, CLI, and API packages (`pnpm test`)
- [X] T073 Verify CLI app runs in terminal without browser API errors — test all screens: home, review, history, settings, onboarding, providers
- [X] T074 Verify web app runs in browser — test all pages: home, review, history, settings, onboarding, providers
- [X] T075 Verify no orphaned imports of deleted hook files remain (`grep -r "use-settings" apps/cli/src/ apps/web/src/` should find only shared imports)
- [X] T076 Remove any unused exports from `@diffgazer/api/hooks` barrel that were never consumed
- [X] T077 Run `quickstart.md` validation — verify setup steps work for a fresh consumer

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 completion — BLOCKS all hook creation
- **Shared Hooks (Phases 3-5)**: Depend on Phase 2. All hooks within Phase 3 and 4 can run in parallel.
- **CLI Wiring (Phase 6)**: Depends on Phase 5 (hooks built)
- **Web Wiring (Phase 7)**: Depends on Phase 5 (hooks built). Can run in parallel with Phase 6.
- **CLI Migration (Phase 8)**: Depends on Phase 6 (CLI has TanStack Query). Can run in parallel with Phase 9.
- **Web Migration (Phase 9)**: Depends on Phase 7 (web has TanStack Query). Can run in parallel with Phase 8.
- **Platform Adapters (Phase 10)**: Depends on Phases 8+9 (both apps migrated)
- **Polish (Phase 11)**: Depends on Phase 10

### User Story Dependencies

- **US1 (Shared Hooks)**: Spans Phases 3-5 (creation) + Phases 8-9 (migration). Core deliverable.
- **US2 (TanStack Query caching)**: Enabled by Phase 7 (web wiring). Validated by Phase 9 migration.
- **US3 (Ink compatibility)**: Enabled by Phase 6 (CLI wiring). Validated by Phase 8 migration.
- **US4 (Platform adapters)**: Phase 10. Depends on US1 completion.

### Within Each Phase

- Tasks marked [P] can run in parallel
- Migration tasks within a phase should be done sequentially (shared state: imports, exports)
- Build verification (T039) must complete before any app wiring

### Parallel Opportunities

**Maximum parallelism in Phase 3** (14 query hooks — all independent files):
```
T012 through T025 can ALL run in parallel (14 agents)
```

**Maximum parallelism in Phase 4** (11 mutation hooks — all independent files):
```
T026 through T036 can ALL run in parallel (11 agents)
```

**Phase 6 + 7 can run in parallel** (CLI and web wiring are independent)

**Phase 8 + 9 can run in parallel** (CLI and web migration are independent)

---

## Parallel Example: Phase 3 (Query Hooks)

```bash
# Launch all 14 query hooks in parallel:
T012: useSettings in packages/api/src/hooks/use-settings.ts
T013: useInit in packages/api/src/hooks/use-init.ts
T014: useConfigCheck in packages/api/src/hooks/use-config-check.ts
T015: useProviderStatus in packages/api/src/hooks/use-provider-status.ts
T016: useOpenRouterModels in packages/api/src/hooks/use-openrouter-models.ts
T017: useReviews in packages/api/src/hooks/use-reviews.ts
T018: useReview in packages/api/src/hooks/use-review.ts
T019: useActiveReviewSession in packages/api/src/hooks/use-active-review-session.ts
T020: useReviewContext in packages/api/src/hooks/use-review-context.ts
T021: useServerStatus in packages/api/src/hooks/use-server-status.ts
T022: useTrust in packages/api/src/hooks/use-trust.ts
T023: useTrustedProjects in packages/api/src/hooks/use-trusted-projects.ts
T024: useGitStatus in packages/api/src/hooks/use-git-status.ts
T025: useGitDiff in packages/api/src/hooks/use-git-diff.ts
```

---

## Implementation Strategy

### MVP First (Phases 1-5 + 6-7)

1. Complete Setup + Foundational → hooks infrastructure ready
2. Create all shared hooks (Phases 3-5) → `@diffgazer/api/hooks` built
3. Wire TanStack Query in both apps (Phases 6-7)
4. **STOP and VALIDATE**: Import one shared hook in each app, verify it works
5. This validates US1, US2, US3 with minimal migration

### Full Migration (Phases 8-9)

6. Migrate CLI hooks → validate CLI works
7. Migrate web hooks → validate web works
8. **STOP and VALIDATE**: Both apps fully on shared hooks

### Polish (Phases 10-11)

9. Simplify platform adapters (ConfigProvider, review lifecycle)
10. Final verification and cleanup

### Parallel Agent Strategy

With up to 50 agents:
- **Phases 3+4**: 25 hooks created in parallel (14 queries + 11 mutations)
- **Phase 5**: 1 agent (streaming hook + barrel)
- **Phases 6+7**: 2 agents in parallel (CLI + web wiring)
- **Phases 8+9**: 2 agents in parallel (CLI + web migration, each agent handles its app sequentially)
- **Phase 10**: 7 tasks, most can be parallelized across 5-7 agents

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each phase's checkpoint validates story independence
- All 14 query hooks and 11 mutation hooks are ~5 lines each (thin wrappers)
- The streaming hook (T037) is the most complex task (~80 lines, extracts logic from both apps)
- ConfigProvider simplification (T064) is the second most complex task
- Migration tasks should preserve existing component behavior — only the hook import and return shape changes
