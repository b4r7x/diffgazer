# Coverage Gap Analysis

## Summary

**131 source files scanned, 55 already have tests, 18 need tests (8 MUST_TEST, 10 SHOULD_TEST), 58 can skip**

### Breakdown by Area
| Area | Source Files | Have Tests | Need Tests | Skip |
|------|-------------|------------|------------|------|
| apps/server | 47 | 29 | 8 | 10 |
| apps/web | 58 | 15 | 6 | 37 |
| packages/core | 12 | 7 | 1 | 4 |
| packages/api | 6 | 2 | 1 | 3 |
| packages/schemas | 14 | 2 | 1 | 11 |
| packages/hooks | 3 | 0 | 1 | 2 |

---

## MUST_TEST Files (Critical Gaps)

### apps/server/src/shared/lib/review/issues.ts
- **Why**: Core issue processing logic -- deduplication, severity filtering, sorting, evidence extraction. Directly affects review quality.
- **Key functions/exports**: `filterIssuesByMinSeverity`, `deduplicateIssues`, `sortIssuesBySeverity`, `ensureIssueEvidence`, `validateIssueCompleteness`
- **Suggested test focus**: Deduplication with same/different keys, severity filtering with boundary cases, evidence extraction from hunks, sort stability
- **Estimated test count**: 12
- **Status**: Already has test file (`issues.test.ts`) -- verify coverage of all 5 exported functions

### apps/server/src/features/review/enrichment.ts
- **Why**: Git blame/context enrichment for issues. Complex async logic with abort handling and error recovery.
- **Key functions/exports**: `enrichIssues`, `enrichIssue` (internal)
- **Suggested test focus**: Blame lookup success/failure, context line extraction, abort signal handling, graceful error recovery per-issue
- **Estimated test count**: 8
- **Status**: Already has test file (`enrichment.test.ts`) -- verify abort and error paths covered

### apps/server/src/shared/lib/http/response.ts
- **Why**: HTTP response helpers used by every router. `zodErrorHandler` is the universal validation error handler.
- **Key functions/exports**: `errorResponse`, `zodErrorHandler`
- **Suggested test focus**: Status code mapping for all valid codes, fallback to 500 for unknown codes, Zod error formatting
- **Estimated test count**: 6

### apps/server/src/features/review/context.ts
- **Why**: Project context discovery -- workspace package scanning, file tree building, caching. Complex FS logic with symlink cycle detection.
- **Key functions/exports**: `buildProjectContextSnapshot`, `loadContextSnapshot`, `buildFileTree` (internal), `discoverWorkspacePackages` (internal), `formatWorkspaceGraph` (internal)
- **Suggested test focus**: Workspace discovery with apps/packages dirs, file tree depth limiting, symlink cycle prevention, cache hit/miss logic, markdown generation
- **Estimated test count**: 10
- **Status**: Already has test file (`context.test.ts`) -- verify coverage of internal helpers

### apps/server/src/features/review/pipeline.ts
- **Why**: Core review pipeline -- resolves git diff, configures review, executes AI analysis, finalizes results. The heart of the review flow.
- **Key functions/exports**: `resolveGitDiff`, `resolveReviewConfig`, `executeReview`, `finalizeReview`, `generateExecutiveSummary`, `generateReport`, `filterDiffByFiles`, `MAX_DIFF_SIZE_BYTES`
- **Suggested test focus**: `filterDiffByFiles` with path normalization, `generateExecutiveSummary` with various severity distributions, `generateReport` output shape, `resolveGitDiff` empty diff / oversized diff / file filtering errors
- **Estimated test count**: 15
- **Status**: Already has test file (`pipeline.test.ts`) -- verify pure functions (`filterDiffByFiles`, `generateExecutiveSummary`, `generateReport`) are covered

### apps/server/src/features/review/drilldown.ts
- **Why**: Issue drilldown analysis -- locates issue in diff, builds prompt, calls AI, saves result. Key user-facing feature.
- **Key functions/exports**: `drilldownIssue`, `drilldownIssueById`, `handleDrilldownRequest`
- **Suggested test focus**: Issue not found error, file matching in diff, trace recording, AI result mapping, save failure handling
- **Estimated test count**: 8
- **Status**: Already has test file (`drilldown.test.ts`) -- verify error paths covered

### apps/server/src/shared/lib/review/analysis.ts
- **Why**: Core AI lens analysis runner -- builds prompt, calls AI, processes results, manages progress events. Most complex single function.
- **Key functions/exports**: `runLensAnalysis`
- **Suggested test focus**: Successful analysis flow, AI error handling, abort signal, progress event emission, evidence enrichment
- **Estimated test count**: 8
- **Status**: Already has test file (`analysis.test.ts`) -- verify error and abort paths

### packages/schemas/src/ui/ui.ts
- **Why**: `calculateSeverityCounts` is used across the stack for severity histogram data. `severityRank` is used for sorting.
- **Key functions/exports**: `calculateSeverityCounts`, `severityRank`
- **Suggested test focus**: Count calculation with all severities, empty input, rank ordering correctness
- **Estimated test count**: 5

---

## SHOULD_TEST Files (Nice to Have)

### apps/server/src/features/review/utils.ts
- **Why**: Utility functions for review routing -- path parsing, error code mapping, trace recording, output summarization.
- **Key functions/exports**: `parseProjectPath`, `errorCodeToStatus`, `handleStoreError`, `reviewAbort`, `isReviewAbort`, `summarizeOutput`, `recordTrace`
- **Suggested test focus**: `summarizeOutput` with different value types, `isReviewAbort` type guard, `errorCodeToStatus` mapping
- **Estimated test count**: 8
- **Status**: Already has test file (`utils.test.ts`) -- verify all utility functions covered

### apps/server/src/features/review/sessions.ts
- **Why**: In-memory session management with eviction, timeout, pub/sub. State management with race condition potential.
- **Key functions/exports**: `createSession`, `addEvent`, `markComplete`, `cancelSession`, `subscribe`, `getActiveSessionForProject`, `evictOldestSession` (internal)
- **Suggested test focus**: Session lifecycle, eviction when at capacity, subscriber notification, cancel propagation, stale session cleanup
- **Estimated test count**: 10
- **Status**: Already has test file (`sessions.test.ts`) -- verify eviction and timeout paths

### apps/server/src/shared/middlewares/trust-guard.ts
- **Why**: Security middleware -- blocks requests without repo read permission. Security-relevant.
- **Key functions/exports**: `requireRepoAccess`
- **Suggested test focus**: Blocks when trust missing, blocks when readFiles false, passes when readFiles true
- **Estimated test count**: 3

### apps/server/src/shared/middlewares/setup-guard.ts
- **Why**: Blocks requests when setup is incomplete. Guards the entire review flow.
- **Key functions/exports**: `requireSetup`
- **Suggested test focus**: Blocks when not ready, includes missing items in message, passes when ready
- **Estimated test count**: 3

### apps/web/src/features/review/components/review-container.utils.ts
- **Why**: Maps review state to progress UI data. Pure transformation logic.
- **Key functions/exports**: `mapStepsToProgressData`, `mapAgentToSubstepStatus`, `getSubstepDetail`, `deriveSubstepsFromAgents`
- **Suggested test focus**: Agent status mapping (queued/running/complete/error), substep detail generation, step-to-progress mapping
- **Estimated test count**: 6
- **Status**: Already has test file (`review-container.utils.test.ts`) -- verify all status mappings covered

### apps/web/src/features/history/utils.tsx
- **Why**: Date formatting, duration formatting, timeline building. Pure utility functions.
- **Key functions/exports**: `getDateKey`, `getDateLabel`, `getTimestamp`, `formatDuration`, `buildTimelineItems`
- **Suggested test focus**: Date edge cases (today/yesterday/older), duration formatting at boundaries, timeline grouping
- **Estimated test count**: 8
- **Status**: Already has test file (`utils.test.ts`) -- verify edge cases

### apps/web/src/app/providers/keyboard-utils.ts
- **Why**: Hotkey matching logic with modifier keys and aliases. Used by keyboard navigation system.
- **Key functions/exports**: `matchesHotkey`, `isInputElement`
- **Suggested test focus**: Key aliases (up/down/esc/space), modifier combinations (ctrl+shift+key), isInputElement for various elements
- **Estimated test count**: 8
- **Status**: Already has test file (`keyboard-utils.test.ts`) -- verify modifier combinations

### packages/core/src/review/filtering.ts
- **Why**: Simple severity filter for issues. Small but used in review display.
- **Key functions/exports**: `filterIssuesBySeverity`
- **Suggested test focus**: Filter by each severity, "all" passthrough, empty input
- **Estimated test count**: 4

### packages/api/src/config.ts
- **Why**: Config API client functions. Thin wrappers but verify correct URL construction and parameter passing.
- **Key functions/exports**: `getProviderStatus`, `saveConfig`, `activateProvider`, `deleteTrust`, `bindConfig`, + 10 more
- **Suggested test focus**: URL construction for `deleteTrust` (query param encoding), `activateProvider` with/without model
- **Estimated test count**: 4

### packages/hooks/src/get-figlet.ts
- **Why**: Font loading with caching, text rendering with error handling.
- **Key functions/exports**: `getFigletText`, `ensureFont`
- **Suggested test focus**: Text rendering with both fonts, caching behavior, error handling (null return)
- **Estimated test count**: 4

---

## SKIP Files (No Tests Needed)

### Type Definition Files
- `apps/server/src/shared/lib/ai/types.ts` -- types only
- `apps/server/src/shared/lib/config/types.ts` -- types only
- `apps/server/src/shared/lib/diff/types.ts` -- types only
- `apps/server/src/shared/lib/git/types.ts` -- types only
- `apps/server/src/shared/lib/http/types.ts` -- types only
- `apps/server/src/shared/lib/review/types.ts` -- types only
- `apps/server/src/shared/lib/storage/types.ts` -- types only
- `apps/server/src/features/review/types.ts` -- types only
- `apps/web/src/features/history/types.ts` -- types only
- `apps/web/src/features/providers/types/index.ts` -- types only
- `apps/web/src/features/onboarding/types.ts` -- types only
- `packages/api/src/types.ts` -- types only

### Barrel/Index Files
- `apps/web/src/components/layout/footer/index.ts` -- barrel export
- `apps/web/src/components/layout/index.ts` -- barrel export
- `apps/web/src/components/ui/badge/index.ts` -- barrel export
- `apps/web/src/components/ui/containers/index.ts` -- barrel export
- `apps/web/src/components/ui/dialog/index.ts` -- barrel export
- `apps/web/src/components/ui/form/index.ts` -- barrel export
- `apps/web/src/components/ui/issue/index.ts` -- barrel export
- `apps/web/src/components/ui/menu/index.ts` -- barrel export
- `apps/web/src/components/ui/navigation-list/index.ts` -- barrel export
- `apps/web/src/components/ui/progress/index.ts` -- barrel export
- `apps/web/src/components/ui/severity/index.ts` -- barrel export
- `apps/web/src/components/ui/tabs/index.ts` -- barrel export
- `apps/web/src/components/ui/toast/index.ts` -- barrel export
- `apps/web/src/features/review/hooks/index.ts` -- barrel export
- `apps/web/src/features/history/hooks/index.ts` -- barrel export
- `apps/web/src/features/history/index.ts` -- barrel export
- `apps/web/src/features/home/index.ts` -- barrel export
- `apps/web/src/features/providers/index.ts` -- barrel export
- `apps/web/src/features/providers/hooks/index.ts` -- barrel export
- `apps/web/src/features/review/index.ts` -- barrel export
- `apps/web/src/features/settings/index.ts` -- barrel export
- `apps/web/src/features/onboarding/hooks/index.ts` -- barrel export
- `apps/web/src/features/onboarding/components/index.ts` -- barrel export
- `apps/web/src/features/onboarding/index.ts` -- barrel export
- `apps/web/src/hooks/index.ts` -- barrel export
- `apps/web/src/hooks/keyboard/index.ts` -- barrel export
- `packages/core/src/index.ts` -- barrel export
- `packages/core/src/review/index.ts` -- barrel export
- `packages/api/src/index.ts` -- barrel export
- `packages/schemas/src/index.ts` -- barrel export
- `packages/schemas/src/config/index.ts` -- barrel export
- `packages/schemas/src/context/index.ts` -- barrel export
- `packages/schemas/src/events/index.ts` -- barrel export
- `packages/schemas/src/git/index.ts` -- barrel export
- `packages/schemas/src/review/index.ts` -- barrel export
- `packages/schemas/src/ui/index.ts` -- barrel export
- `packages/hooks/src/index.ts` -- barrel export

### Re-export/Thin Wrapper Files
- `packages/core/src/severity.ts` -- pure re-export from schemas/ui
- `packages/api/src/bound.ts` -- thin composition of bind functions
- `packages/api/src/git.ts` -- thin API wrappers (tested via client.test.ts)

### Constants-Only Files
- `apps/web/src/config/constants.ts` -- constants only
- `apps/web/src/components/ui/severity/constants.ts` -- constants only
- `apps/web/src/features/providers/constants.ts` -- constants only

### Schema-Only Files (Zod validates itself)
- `apps/server/src/features/config/schemas.ts` -- Zod schemas
- `apps/server/src/features/git/schemas.ts` -- Zod schemas
- `apps/server/src/features/review/schemas.ts` -- Zod schemas (already has test for custom validators)
- `apps/server/src/features/settings/schemas.ts` -- Zod schemas
- `packages/schemas/src/config/settings.ts` -- Zod schemas
- `packages/schemas/src/config/providers.ts` -- Zod schemas (already has test for custom logic)
- `packages/schemas/src/context/context.ts` -- Zod schemas
- `packages/schemas/src/errors.ts` -- Zod schemas + constants
- `packages/schemas/src/events/stream.ts` -- Zod schemas
- `packages/schemas/src/events/enrich.ts` -- Zod schemas
- `packages/schemas/src/git/git.ts` -- Zod schemas
- `packages/schemas/src/review/issues.ts` -- Zod schemas
- `packages/schemas/src/review/lens.ts` -- Zod schemas
- `packages/schemas/src/review/storage.ts` -- Zod schemas (already has test)

### Pure UI Components (no logic to test)
- All `apps/web/src/components/ui/**/*.tsx` -- pure JSX rendering
- All `apps/web/src/components/shared/*.tsx` -- pure JSX rendering
- All `apps/web/src/features/*/components/*.tsx` -- pure JSX rendering
- All `apps/web/src/app/routes/**/*.tsx` -- route definitions

### Entry Points / Config
- `apps/server/src/index.ts` -- server entry point
- `apps/server/src/dev.ts` -- dev entry point

### Server Data Files (no logic)
- `apps/server/src/shared/lib/review/lenses.ts` -- constant data mapping
- `apps/server/src/shared/lib/review/profiles.ts` -- constant data mapping

### Trivial Files
- `apps/server/src/features/health/router.ts` -- returns `{ status: "ok" }`
- `apps/server/src/shared/lib/http/sse.ts` -- 5-line wrapper around stream.writeSSE
- `apps/server/src/shared/lib/http/request.ts` -- 3-line wrapper
- `apps/server/src/shared/middlewares/body-limit.ts` -- 4-line Hono wrapper
- `apps/server/src/shared/lib/validation.ts` -- already has test
- `apps/server/src/shared/lib/__mocks__/paths.ts` -- test mock
- `apps/server/src/shared/lib/__mocks__/fs.ts` -- test mock
- `apps/web/src/features/home/utils/shutdown.ts` -- 4-line fire-and-forget
- `apps/web/src/components/ui/form/selectable-item.ts` -- tiny utility

### Web Hooks (deeply integrated with React/Router context, better tested as integration)
- `apps/web/src/features/review/hooks/use-review-lifecycle.ts` -- orchestration hook, composes other hooks
- `apps/web/src/features/review/hooks/use-review-stream.ts` -- SSE stream hook with rAF batching
- `apps/web/src/features/review/hooks/use-review-error-handler.ts` -- toast + navigate side effects
- `apps/web/src/features/review/hooks/use-review-settings.ts` -- thin settings wrapper
- `apps/web/src/features/review/hooks/use-context-snapshot.ts` -- data fetching hook
- `apps/web/src/features/review/hooks/use-review-progress-keyboard.ts` -- keyboard handler
- `apps/web/src/features/review/hooks/use-review-results-keyboard.ts` -- keyboard handler
- `apps/web/src/features/history/hooks/use-history-keyboard.ts` -- keyboard handler
- `apps/web/src/features/history/hooks/use-review-detail.ts` -- data fetching hook
- `apps/web/src/features/history/hooks/use-review-history.ts` -- composition hook
- `apps/web/src/features/history/hooks/use-history-page.ts` -- page state hook
- `apps/web/src/features/providers/hooks/use-providers.ts` -- data mapping hook
- `apps/web/src/features/providers/hooks/use-provider-management.ts` -- orchestration hook
- `apps/web/src/features/providers/hooks/use-providers-page-state.ts` -- page state hook
- `apps/web/src/features/providers/hooks/use-model-dialog-keyboard.ts` -- keyboard handler
- `apps/web/src/features/providers/hooks/use-providers-keyboard.ts` -- keyboard handler
- `apps/web/src/features/settings/hooks/use-context-management.ts` -- data management hook
- `apps/web/src/features/onboarding/hooks/use-onboarding.ts` -- wizard state hook
- `apps/web/src/hooks/use-openrouter-models.ts` -- data fetching hook with reducer
- `apps/web/src/hooks/use-scroll-into-view.ts` -- DOM measurement hook
- `apps/web/src/hooks/use-page-footer.ts` -- layout hook
- `apps/web/src/hooks/use-theme.ts` -- theme context hook
- `apps/web/src/hooks/use-server-status.ts` -- polling hook
- `apps/web/src/hooks/use-trust.ts` -- data fetching hook
- `apps/web/src/hooks/keyboard/use-key.ts` -- keyboard primitive
- `apps/web/src/hooks/keyboard/use-keyboard-context.ts` -- context hook
- `apps/web/src/hooks/keyboard/use-keys.ts` -- keyboard primitive
- `apps/web/src/hooks/keyboard/use-scope.ts` -- scope management
- `apps/web/src/hooks/keyboard/use-trust-form-keyboard.ts` -- keyboard handler
- `apps/web/src/hooks/keyboard/use-group-navigation.ts` -- keyboard handler
- `apps/web/src/hooks/keyboard/use-footer-navigation.ts` -- keyboard handler
- `apps/web/src/app/providers/config-provider.tsx` -- React context provider
- `apps/web/src/app/providers/keyboard-provider.tsx` -- React context provider
- `apps/web/src/app/providers/theme-provider.tsx` -- React context (already has test)
- `apps/web/src/app/providers/index.tsx` -- provider composition
- `apps/web/src/app/router.tsx` -- router config
- `apps/web/src/components/ui/toast/toast-context.tsx` -- React context (already has test)
- `apps/web/src/components/ui/dialog/dialog-context.tsx` -- React context
- `apps/web/src/components/ui/menu/menu-context.tsx` -- React context
- `apps/web/src/components/ui/navigation-list/navigation-list-context.tsx` -- React context
- `apps/web/src/components/ui/tabs/tabs-context.tsx` -- React context
- `apps/web/src/components/layout/footer/footer-context.tsx` -- React context
- `packages/hooks/src/use-timer.ts` -- React hook (needs React test environment)
- `packages/schemas/src/events/step.ts` -- Zod schemas + constants
- `packages/schemas/src/events/agent.ts` -- Zod schemas + constants

### Router Files (integration-level, tested via app.test.ts)
- `apps/server/src/features/review/router.ts` -- route definitions
- `apps/server/src/features/config/router.ts` -- route definitions
- `apps/server/src/features/git/router.ts` -- route definitions
- `apps/server/src/features/settings/router.ts` -- route definitions
- `apps/server/src/app.ts` -- already has test
