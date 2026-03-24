# Tasks: CLI Backend Integration

**Input**: Design documents from `/specs/005-cli-backend-integration/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/api-consumption.md

**Tests**: Not requested — testing is out of scope for this integration (per plan.md).

**Organization**: Tasks grouped by user story. Up to 28 parallel Opus agents in Wave 2.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story (US1-US6)
- Exact file paths relative to `apps/cli/src/`

## Path Conventions

All paths relative to `apps/cli/src/` unless otherwise noted.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Add required dependencies to the CLI app

- [x] T001 Add `@diffgazer/api`, `@diffgazer/core`, and `@diffgazer/schemas` as dependencies in `apps/cli/package.json` and run `pnpm install`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Create the API client, server health gating, config guard, and shared data hooks that ALL user stories depend on

**CRITICAL**: No user story work can begin until this phase is complete

- [x] T002 Create API client singleton module at `lib/api.ts` — export `api` via `createApi({ baseUrl: "http://127.0.0.1:3000", projectRoot: process.cwd() })` from `@diffgazer/api`. Reference: `apps/web/src/lib/api.ts`
- [x] T003 Create server health polling hook at `hooks/use-server-status.ts` — three-state machine (checking/connected/error), polls `GET /api/health` on mount, 30s interval, retry function. Reference: `apps/web/src/hooks/use-server-status.ts`
- [x] T004 Add health gate to App component in `app/index.tsx` — gate ScreenRouter behind `useServerStatus()`: show "Connecting..." spinner during checking, "Server Disconnected" + retry button on error, render children only when connected
- [x] T005 [P] Create init data hook at `hooks/use-init.ts` — fetch `api.loadInit()` after server connects, return `{ data, isLoading, error, refresh }` with InitResponse type from `@diffgazer/schemas`
- [x] T006 [P] Create settings fetch hook at `hooks/use-settings.ts` — fetch `api.getSettings()` on mount, return `{ settings, isLoading, error, refresh }` with SettingsConfig type from `@diffgazer/schemas`
- [x] T007 Create config guard hook at `hooks/use-config-guard.ts` and wire to App in `app/index.tsx` — after server connected, call `api.checkConfig()`, if `configured: false` navigate to onboarding screen, if `true` navigate to home. Reference: `apps/web/src/lib/config-guards/config-guards.ts`

**Checkpoint**: Foundation ready — API client, health gate, config guard, init/settings hooks all operational. User story implementation can now begin in parallel.

---

## Phase 3: User Story 1 — Start and Complete a Real Code Review from CLI (Priority: P1)

**Goal**: Replace all mock review data with real SSE streaming, delivering the core product functionality end-to-end.

**Independent Test**: Run `diffgazer` CLI in a git repo with unstaged changes, select "Review Unstaged", verify real issues appear with severity, code evidence, and fix plans.

### Implementation for User Story 1

- [x] T008 [P] [US1] Rewrite review stream hook at `features/review/hooks/use-review-stream.ts` — replace MOCK_STEPS, MOCK_LOG_ENTRIES, and setTimeout simulation with real SSE streaming: use `useReducer(reviewReducer, createInitialReviewState())` from `@diffgazer/core/review`, call `api.streamReviewWithEvents()` with `onAgentEvent`/`onStepEvent`/`onEnrichEvent` callbacks that dispatch to reducer, add `AbortController` lifecycle, add `resume(reviewId)` via `api.resumeReviewStream()` with SESSION_STALE/SESSION_NOT_FOUND handling, replace `requestAnimationFrame` batching with `setTimeout(fn, 0)` or skip (Ink batches updates). Remove all MOCK_* constants. Reference: `apps/web/src/features/review/hooks/use-review-stream.ts`
- [x] T009 [P] [US1] Rewrite review lifecycle hook at `features/review/hooks/use-review-lifecycle.ts` — replace MOCK_ISSUES, MOCK_SUMMARY, and simple phase state with real orchestration: consume new `useReviewStream()`, add config checking (verify provider is configured via `useInit()`), add default lenses loading via `useSettings()`, add active session check via `api.getActiveReviewSession(mode)` with resume/start-fresh logic, add completion transition delay, derive `isNoDiffError`, `isCheckingForChanges` from state. Remove all MOCK_* constants. Reference: `apps/web/src/features/review/hooks/use-review-lifecycle.ts`
- [x] T010 [P] [US1] Update review container at `features/review/components/review-container.tsx` — connect to real `useReviewLifecycle()`, add rendering for config-not-set state (ApiKeyMissing), no-changes state, transform `state.steps`/`state.agents`/`state.events` for progress view using `convertAgentEventsToLogEntries()` from `@diffgazer/core/review`. Reference: `apps/web/src/features/review/components/review-container.tsx`
- [x] T011 [P] [US1] Update review progress view at `features/review/components/review-progress-view.tsx` — consume real `StepState[]` and `AgentState[]` from review state instead of mock flat arrays, map agent events to log entries using `convertAgentEventsToLogEntries()`, display real file progress from `state.fileProgress`
- [x] T012 [P] [US1] Update review summary view at `features/review/components/review-summary-view.tsx` — consume real `ReviewResult` summary data (total issues, severity breakdown by blocker/high/medium/low/nit, duration, files analyzed) from the completed review state instead of MOCK_SUMMARY
- [x] T013 [P] [US1] Update review results issue list at `features/review/components/review-results-view.tsx` and `features/review/components/issue-list-pane.tsx` — consume real `ReviewIssue[]` from review state, implement severity filtering (all/blocker/high/medium/low/nit) using real issue data, display real file paths, severity badges, and issue titles
- [x] T014 [P] [US1] Update review issue details at `features/review/components/issue-details-pane.tsx` — populate all detail tabs from real `ReviewIssue` data: Overview tab (description, code evidence with line numbers, "Why It Matters", fix plan checklist), Explain tab (explanation text), Trace tab (agent tool trace steps), Patch tab (suggested_patch diff when present)
- [x] T015 [P] [US1] Add saved review loading to review screen at `app/screens/review-screen.tsx` — when navigating to a review with a reviewId, load saved review via `api.getReview(reviewId)`, if found with results go directly to results phase, if not found start fresh review. Reference: `apps/web/src/features/review/components/page.tsx`
- [x] T016 [P] [US1] Add review mode switching at `app/screens/review-screen.tsx` — pass real mode parameter (staged/unstaged) to the review lifecycle hook, support switching between modes from the "No Changes" view

**Checkpoint**: Real code review works end-to-end — streaming, progress, summary, and results all use real backend data.

---

## Phase 4: User Story 2 — Configure AI Provider and Settings via CLI (Priority: P2)

**Goal**: All onboarding and settings screens persist to the real backend, sharing config with the web UI.

**Independent Test**: Complete onboarding wizard in CLI, open web UI, verify same provider/model/settings are active.

### Implementation for User Story 2

- [x] T017 [P] [US2] Wire onboarding wizard completion at `features/onboarding/components/onboarding-wizard.tsx` — on `onComplete`, call `api.saveSettings({ secretsStorage, defaultLenses: selectedLenses, agentExecution })` then `api.saveConfig({ provider, apiKey, model })`, show saving state, handle errors, navigate to home on success. Remove hardcoded `defaultAgents`. Reference: `apps/web/src/features/onboarding/hooks/use-onboarding.ts`
- [x] T018 [P] [US2] Replace hardcoded providers in `features/onboarding/components/steps/provider-step.tsx` — fetch real provider list from `api.getProviderStatus()` on mount, render RadioGroup items dynamically from response. Remove hardcoded provider RadioGroup.Item entries
- [x] T019 [P] [US2] Replace hardcoded models in `features/onboarding/components/steps/model-step.tsx` — fetch models per selected provider: use `api.getOpenRouterModels()` for OpenRouter, derive from `api.getProviderStatus()` for others. Remove `modelsByProvider` hardcoded object
- [x] T020 [P] [US2] Wire providers screen at `app/screens/settings/providers-screen.tsx` and `features/providers/components/provider-list.tsx` and `features/providers/components/provider-details.tsx` — replace MOCK_PROVIDERS and MOCK_MODELS with real data from `api.getProviderStatus()`, load on mount with loading/error states. Reference: `apps/web/src/features/providers/components/page.tsx`
- [x] T021 [P] [US2] Wire API key save in `features/providers/components/api-key-overlay.tsx` — replace TODO with real `api.saveConfig({ provider, apiKey })` call, show saving indicator, handle errors, refresh provider list on success
- [x] T022 [P] [US2] Wire model selector in `features/providers/components/model-select-overlay.tsx` — replace MOCK_MODELS with real model data, fetch OpenRouter models via `api.getOpenRouterModels()`, call `api.activateProvider(providerId, modelId)` on selection
- [x] T023 [P] [US2] Wire storage settings at `app/screens/settings/storage-screen.tsx` — load current value via `api.getSettings()` on mount (replace hardcoded `useState("file")`), save via `api.saveSettings({ secretsStorage })` (replace TODO), add loading/saving/error states
- [x] T024 [P] [US2] Wire analysis settings at `app/screens/settings/analysis-screen.tsx` and `features/settings/components/analysis-selector.tsx` — load current `defaultLenses` via `api.getSettings()` (replace hardcoded agents array and `useState`), save via `api.saveSettings({ defaultLenses })` (replace TODO, fix field name from `analysisAgents` to `defaultLenses`)
- [x] T025 [P] [US2] Wire agent execution settings at `app/screens/settings/agent-execution-screen.tsx` — load current `agentExecution` via `api.getSettings()` (replace hardcoded `useState("parallel")`), save via `api.saveSettings({ agentExecution })` (replace TODO, fix field name from `executionMode` to `agentExecution`)
- [x] T026 [P] [US2] Wire trust permissions at `app/screens/settings/trust-permissions-screen.tsx` — load current trust via `useInit()` (replace hardcoded `useState({ readFiles: false, runCommands: false })`), save via `api.saveTrust({ projectId, repoRoot, capabilities, trustMode, trustedAt })` (replace TODO, fix: use `api.saveTrust()` not `api.saveSettings()`), add revoke via `api.deleteTrust(projectId)`
- [x] T027 [P] [US2] Wire settings hub at `app/screens/settings/hub-screen.tsx` — load real current values from `useInit()` + `useSettings()` on mount, display active provider name, trust status, theme, storage type, execution mode, lens count as menu item descriptions (replace static descriptions)

**Checkpoint**: All settings persist to backend, shared with web UI. Onboarding wizard works end-to-end.

---

## Phase 5: User Story 3 — Browse Review History from CLI (Priority: P3)

**Goal**: History screen shows real past reviews from the backend store.

**Independent Test**: Run a review from web UI, open CLI History, verify review appears with correct metadata.

### Implementation for User Story 3

- [x] T028 [P] [US3] Wire history screen at `app/screens/history-screen.tsx` and `features/history/components/timeline-list.tsx` — replace MOCK_REVIEWS with real data from `api.getReviews()`, add loading/error/empty states, group reviews by date (today, yesterday, specific dates), support search filtering by ID/branch/project path. Remove all MOCK_REVIEWS constants. Reference: `apps/web/src/features/history/components/page.tsx`
- [x] T029 [P] [US3] Wire history insights and navigation at `features/history/components/history-insights-pane.tsx` — populate selected review detail pane with real review data (severity counts, issue list, duration), on Enter navigate to review screen with reviewId to load full results via `api.getReview(id)`

**Checkpoint**: History shows real reviews, navigation to saved review results works.

---

## Phase 6: User Story 4 — Home Screen with Live Backend State (Priority: P4)

**Goal**: Home screen reflects real backend state in context sidebar and menu items.

**Independent Test**: Launch CLI, verify context sidebar shows real active provider, model, trust status, and last review.

### Implementation for User Story 4

- [x] T030 [P] [US4] Wire home screen init data and context sidebar at `app/screens/home-screen.tsx` and `features/home/components/context-sidebar.tsx` — replace hardcoded provider name "—" with real data from `useInit()`, pass real provider name, model, trust status to ContextSidebar, fetch last review from `api.getReviews()` for display. Reference: `apps/web/src/features/home/components/page.tsx`
- [x] T031 [P] [US4] Wire trust panel at `features/home/components/trust-panel.tsx` — replace TODO with real `api.saveTrust({ projectId, repoRoot, capabilities: { readFiles, runCommands }, trustMode, trustedAt })` call on trust accept, refresh init data after saving
- [x] T032 [P] [US4] Wire menu item state at `app/screens/home-screen.tsx` — check for active review session via `api.getActiveReviewSession()` to enable/disable "Resume Last Review", disable review actions if trust not granted, show last review issue count
- [x] T033 [P] [US4] Wire header with real provider status at `components/layout/global-layout.tsx` and `components/layout/header.tsx` — replace hardcoded `providerName="diffgazer"` and `providerStatus="idle"` with real data from `useInit()`: active provider name, and whether a review is currently streaming. Reference: `apps/web/src/components/layout/header.tsx`
- [x] T034 [P] [US4] Wire shutdown flow at `app/screens/home-screen.tsx` quit handler — call `api.shutdown()` before `process.exit(0)` to properly terminate the server process

**Checkpoint**: Home screen shows real backend state, trust panel saves, quit shuts down server.

---

## Phase 7: User Story 5 — Diagnostics and System Health from CLI (Priority: P5)

**Goal**: Diagnostics screen shows real health data and supports context regeneration.

**Independent Test**: Open Settings > Diagnostics, verify real server health, setup status, context snapshot state.

### Implementation for User Story 5

- [x] T035 [US5] Wire diagnostics screen at `app/screens/settings/diagnostics-screen.tsx` — replace hardcoded server status and git version with real data: server health from health endpoint, setup completeness from `useInit()`, context snapshot status from `api.getReviewContext()`, wire "Regenerate Context" button to `api.refreshReviewContext({ force: true })`, add loading/error states. Reference: `apps/web/src/features/settings/components/diagnostics/page.tsx`

**Checkpoint**: Diagnostics shows real health data, context regeneration works.

---

## Phase 8: User Story 6 — Terminal Responsiveness Across All Screens (Priority: P6)

**Goal**: All screens adapt layout to terminal dimensions.

**Independent Test**: Resize terminal while on each screen, verify no overlapping content or broken layouts.

### Implementation for User Story 6

- [x] T036 [US6] Audit and fix terminal responsiveness across all screens — verify two-pane layouts (review results, history, providers) use `useTerminalDimensions()` to adapt: side-by-side at 120+ columns, stacked/focused at <80 columns. Check scroll areas adjust height on resize. Test at 40, 80, 120, 200 columns.

**Checkpoint**: All screens render correctly at various terminal widths.

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Verify completeness across all user stories

- [x] T037 [P] Mock data removal audit — run `grep -r "MOCK_" apps/cli/src/` and `grep -r "// TODO" apps/cli/src/` to verify zero mock constants and zero TODO stubs remain in production source
- [x] T038 [P] Web-CLI parity audit — compare all 13 CLI screens against their web counterparts, verify each screen consumes the same backend endpoints (per contracts/api-consumption.md), verify data shapes match, verify loading/error states exist
- [x] T039 [P] Fix theme settings TODO at `app/screens/settings/theme-screen.tsx` — remove the incorrect `// TODO: call api.saveSettings({ theme })` comment (web also stores theme client-side, not via API), keep theme as local CLI state via existing `CliThemeProvider`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories
- **User Stories (Phases 3-8)**: All depend on Foundational phase completion
  - All 6 user stories can proceed **in parallel** (up to 28 agents)
  - Or sequentially in priority order (P1 → P2 → P3 → P4 → P5 → P6)
- **Polish (Phase 9)**: Depends on all user stories being complete

### User Story Dependencies

- **US1 (Review)**: Can start after Phase 2 — no dependencies on other stories
- **US2 (Config/Settings)**: Can start after Phase 2 — no dependencies on other stories
- **US3 (History)**: Can start after Phase 2 — no dependencies on other stories
- **US4 (Home Screen)**: Can start after Phase 2 — no dependencies on other stories
- **US5 (Diagnostics)**: Can start after Phase 2 — no dependencies on other stories
- **US6 (Responsiveness)**: Best done AFTER other stories (audits real data layouts)

### Within Each User Story

- All tasks marked [P] within a story can run in parallel (different files)
- No models/services separation — all tasks are screen-level integration

### Parallel Opportunities

**Maximum parallelism (Wave 2): 28 concurrent agents**

All US1-US5 implementation tasks can run simultaneously:
- US1: 9 parallel agents (T008-T016)
- US2: 11 parallel agents (T017-T027)
- US3: 2 parallel agents (T028-T029)
- US4: 5 parallel agents (T030-T034)
- US5: 1 agent (T035)
- Total: 28 parallel agents

---

## Parallel Example: All User Stories Simultaneously

```
# Wave 1: Foundation (sequential, ~6 tasks)
Agent 0: T001 → T002 → T003 → T004 → T005 → T006 → T007

# Wave 2: All stories in parallel (28 agents)
Agent 1:  T008 [US1] Rewrite review stream hook
Agent 2:  T009 [US1] Rewrite review lifecycle hook
Agent 3:  T010 [US1] Update review container
Agent 4:  T011 [US1] Update review progress view
Agent 5:  T012 [US1] Update review summary view
Agent 6:  T013 [US1] Update review results issue list
Agent 7:  T014 [US1] Update review issue details
Agent 8:  T015 [US1] Add saved review loading
Agent 9:  T016 [US1] Add review mode switching
Agent 10: T017 [US2] Wire onboarding wizard completion
Agent 11: T018 [US2] Replace hardcoded providers in onboarding
Agent 12: T019 [US2] Replace hardcoded models in onboarding
Agent 13: T020 [US2] Wire providers screen
Agent 14: T021 [US2] Wire API key save
Agent 15: T022 [US2] Wire model selector
Agent 16: T023 [US2] Wire storage settings
Agent 17: T024 [US2] Wire analysis settings
Agent 18: T025 [US2] Wire agent execution settings
Agent 19: T026 [US2] Wire trust permissions
Agent 20: T027 [US2] Wire settings hub
Agent 21: T028 [US3] Wire history screen
Agent 22: T029 [US3] Wire history insights
Agent 23: T030 [US4] Wire home screen + context sidebar
Agent 24: T031 [US4] Wire trust panel
Agent 25: T032 [US4] Wire menu item state
Agent 26: T033 [US4] Wire header provider status
Agent 27: T034 [US4] Wire shutdown flow
Agent 28: T035 [US5] Wire diagnostics screen

# Wave 3: Verification (3 agents)
Agent 29: T036 [US6] Responsiveness audit
Agent 30: T037 Mock data removal audit
Agent 31: T038 Web-CLI parity audit
Agent 32: T039 Fix theme TODO
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001)
2. Complete Phase 2: Foundation (T002-T007)
3. Complete Phase 3: US1 Review Flow (T008-T016)
4. **STOP and VALIDATE**: Start a real review from CLI, verify issues appear
5. This alone proves the CLI is a functional product

### Full Parallel Delivery (All Stories)

1. Complete Setup + Foundation (T001-T007, sequential)
2. Launch 28 parallel agents for all user stories (T008-T035)
3. Launch 4 parallel agents for polish (T036-T039)
4. Total: 39 tasks, ~32 parallel in Wave 2+3

### Incremental Delivery

1. Foundation → US1 (Review) → validate core flow
2. Add US2 (Config) → validate settings persistence
3. Add US4 (Home) → validate home screen state
4. Add US3 (History) → validate history browsing
5. Add US5 (Diagnostics) → validate health checks
6. Add US6 (Responsiveness) → audit layouts
7. Polish → verify completeness

---

## Notes

- [P] tasks = different files, no dependencies — safe for parallel agents
- [US*] label maps task to specific user story for traceability
- Each agent gets the per-agent prompt template from plan.md with task-specific details
- All file paths relative to `apps/cli/src/` unless noted
- ESM imports with `.js` extensions required throughout
- Use exact schema field names: `defaultLenses` (not `analysisAgents`), `agentExecution` (not `executionMode`), `api.saveTrust()` (not `api.saveSettings()` for trust)
- Theme stays local — do NOT call API for theme persistence (research.md decision #6)
