# Diffgazer: feature/review-bounding Refactor Prompt

> This document contains all findings and instructions for refactoring the `feature/review-bounding` branch.
> Written for an AI coding agent with empty context. All file paths are absolute from project root.

## Project Overview

Diffgazer is a TypeScript monorepo (pnpm workspaces) that performs AI-powered code reviews. It has:

- `apps/server/` — Hono-based HTTP server (REST + SSE streaming)
- `apps/web/` — React SPA (Vite + TanStack Router)
- `apps/cli/` — CLI tool (React Ink)
- `packages/schemas/` — Zod schemas + domain types (shared by all)
- `packages/core/` — Shared business logic (review state, event parsing)
- `packages/api/` — HTTP client SDK for the server
- `packages/hooks/` — Shared React hooks (used by web + cli)

### Key Architecture Principles

1. **`packages/`** contains ONLY code reused across multiple apps (types, schemas, shared logic)
2. **`apps/server/src/shared/lib/`** contains server-only shared code (AI client, git, storage, config)
3. **Feature folders** follow pattern: `router.ts` (routes) + `service.ts` (business logic) + `types.ts` (optional re-exports)
4. **No over-engineering** — prefer simple, direct code over abstractions
5. **Hono patterns** — handlers inline with routes, business logic in service layer, middleware for cross-cutting concerns

---

## Phase 1: Extract Shared Review Engine

**Priority: CRITICAL**
**Goal:** Eliminate ~800 lines of duplicated code between `review/service.ts` and `pr-review/router.ts`.

### Current State

`apps/server/src/features/review/service.ts` (1792 lines) and `apps/server/src/features/pr-review/router.ts` (991 lines) contain identical copies of:

- 5 lens definitions (correctness, security, performance, simplicity, tests)
- 4 profile definitions (quick, strict, perf, security)
- Utility functions: `severityRank`, `severityMeetsMinimum`, `filterIssuesBySeverity`, `buildTriagePrompt`, `deduplicateIssues`, `sortIssuesBySeverity`, `extractEvidenceFromDiff`, `ensureIssueEvidence`, `validateIssueCompleteness`, `estimateTokens`, `now`, `getThinkingMessage`
- `runLensAnalysis` (~200 lines each)
- `runWithConcurrency` (~35 lines each)
- `LensResult` interface, `AgentRunContext` interface

Both files have comments like `// ============= Inlined from shared/lib/review/lenses/index.ts =============` confirming these were separate modules that got inlined.

### Instructions

Create the following shared modules under `apps/server/src/shared/lib/review/`:

#### 1. `apps/server/src/shared/lib/review/lenses.ts`
Extract from `apps/server/src/features/review/service.ts` lines 240-428:
- `Lens` interface
- All 5 lens objects (`correctness`, `security`, `performance`, `simplicity`, `tests`)
- `LENSES` record
- `getLenses(selected?: string[]): Lens[]` function

#### 2. `apps/server/src/shared/lib/review/profiles.ts`
Extract from `apps/server/src/features/review/service.ts` lines 436-467:
- `ReviewProfile` type
- `PROFILES` record (quick, strict, perf, security)
- `getProfile(name: string): ReviewProfile | undefined` function

#### 3. `apps/server/src/shared/lib/review/analysis.ts`
Extract from `apps/server/src/features/review/service.ts`:
- `LensResult` interface
- `AgentRunContext` interface
- `buildTriagePrompt(lens, diff, projectContext?)` — make `projectContext` optional parameter
- `runLensAnalysis(context: AgentRunContext)` — the core function that calls AI and parses results
- `runWithConcurrency(tasks, concurrency)` — generic concurrency utility

#### 4. `apps/server/src/shared/lib/review/issues.ts`
Extract from `apps/server/src/features/review/service.ts`:
- `severityRank(severity)`
- `severityMeetsMinimum(severity, minimum)`
- `filterIssuesBySeverity(issues, minimum)`
- `deduplicateIssues(issues)`
- `sortIssuesBySeverity(issues)`
- `extractEvidenceFromDiff(issue, diff)`
- `ensureIssueEvidence(issue, diff)`
- `validateIssueCompleteness(issue)`

#### 5. `apps/server/src/shared/lib/review/utils.ts`
Extract:
- `estimateTokens(text)` — from `review/service.ts`
- `getThinkingMessage()` — from `review/service.ts`
- `now()` — `new Date().toISOString()` helper (also duplicated in `review/router.ts:37-39`)

#### 6. `apps/server/src/shared/lib/review/index.ts`
Barrel export for all the above.

### After Extraction

Update these files to import from `shared/lib/review/`:
- `apps/server/src/features/review/service.ts` — remove all inlined code, import shared modules
- `apps/server/src/features/pr-review/router.ts` — remove all inlined code (~lines 40-930), import shared modules. Move remaining business logic to `pr-review/service.ts`.

**Important behavioral difference to preserve:**
- `review/service.ts` uses `MAX_AGENT_CONCURRENCY = 1` (sequential) — this is the local review mode
- `pr-review/router.ts` uses `MAX_AGENT_CONCURRENCY = 3` (parallel) — this is the CI/API mode
- The concurrency value should be a parameter, not hardcoded in the shared module

---

## Phase 2: Break Up review/service.ts Monolith

**Priority: CRITICAL**
**Goal:** Split the 1792-line monolith into focused modules.

### Current Structure (all in one file)

```
review/service.ts:
  Lines 60-164:  Active session management (inlined from active-sessions.ts)
  Lines 166-238: Git diff error classification (inlined)
  Lines 240-428: Lens definitions (→ moved to shared in Phase 1)
  Lines 434-467: Profile definitions (→ moved to shared in Phase 1)
  Lines 469-1412: Core triage engine (partially → shared in Phase 1)
  Lines 486-789: Project context/snapshot system
  Lines 1476-1562: Issue enrichment system
  Lines 1573-1791: SSE stream orchestration
```

### Instructions

After Phase 1 extraction, further split `review/service.ts`:

#### 1. `apps/server/src/features/review/sessions.ts`
Extract lines 60-164:
- `ActiveSession` interface
- `activeSessions` Map
- `createSession`, `markReady`, `addEvent`, `markComplete`, `subscribe`, `getActiveSessionForProject`, `getSession`
- Fix the memory leak: ensure `activeSessions.delete(reviewId)` is called in error paths (the earlier fix team already did this, verify it's preserved)

#### 2. `apps/server/src/shared/lib/git/errors.ts`
Extract lines 166-238 (also duplicated in `diff-review/service.ts:27-97`):
- `GitDiffErrorCode` type
- `classifyGitDiffError(error)` — simplify by removing the `createErrorClassifier` factory pattern. Just write a direct function with the rules inlined.
- `createGitDiffError(error)` function
- Delete the duplicate from `diff-review/service.ts` and import from here

#### 3. `apps/server/src/features/review/context.ts`
Extract lines 486-789:
- `readJsonFile` utility
- `findWorkspaceConfig`
- `collectFileTree`
- `readConfigFiles`
- `buildProjectContextSnapshot`
- Remove the trivial wrapper `ensureProjectContextSnapshot` — just export `buildProjectContextSnapshot` directly

#### 4. `apps/server/src/features/review/enrichment.ts`
Extract lines 1476-1562:
- Issue enrichment logic (the post-analysis pass that adds evidence and validates completeness)

#### Result
`review/service.ts` should contain only:
- The main `reviewStream` orchestrator function
- The `streamReviewToSSE` function
- Imports from all the extracted modules

Target: under 400 lines.

---

## Phase 3: Move pr-review Business Logic to Service Layer

**Priority: HIGH**
**Goal:** Follow the project convention of router.ts (routes) + service.ts (business logic).

### Current State

`apps/server/src/features/pr-review/router.ts` is 991 lines. Lines 40-930 are business logic (lens definitions, review engine, orchestration). The actual route handler is only lines 932-991. `pr-review/service.ts` exists but only has response formatting helpers (91 lines).

### Instructions

1. After Phase 1 (shared extraction), `pr-review/router.ts` should only have:
   - Route handler at the bottom (~60 lines)
   - Import from shared modules

2. Move any remaining pr-review-specific logic (the `triageReview` and `triageReviewStream` orchestrators) into `pr-review/service.ts`.

3. `pr-review/router.ts` should be under 100 lines — just the route definition that calls the service.

---

## Phase 4: Merge diff-review into review/

**Priority: HIGH**
**Goal:** Consolidate 3 review features into 2 (review/ for local, pr-review/ for CI).

### Current State

`apps/server/src/features/diff-review/` has:
- `router.ts` — Hono router with a streaming review endpoint
- `service.ts` — Uses raw `generateStream` with a single prompt (no lenses), has its own review store

This is a simpler review mode that was recently registered in `routes.ts`.

### Instructions

1. Absorb `diff-review` functionality into `review/` as another mode (e.g. `mode: "simple"` vs `mode: "lens"`)
2. Move the simpler single-prompt review logic into `review/service.ts` as an alternative to the lens pipeline
3. Use the same storage system (`shared/lib/storage/reviews.ts`) instead of the separate store in `diff-review/service.ts`
4. Delete `apps/server/src/features/diff-review/` directory
5. Remove the diff-review router registration from `apps/server/src/routes.ts`
6. Delete `packages/schemas/src/diff-review.ts` and `packages/schemas/src/diff-review-history.ts` (merge any needed types into `review.ts`)
7. Delete `packages/api/src/diff-review.ts` (it's already orphaned/not imported)
8. Update `packages/schemas/src/index.ts` and `packages/schemas/package.json` to remove diff-review exports

---

## Phase 5: Complete Triage → Review Rename

**Priority: HIGH**
**Goal:** Rename all `Triage*` types/schemas to `Review*` throughout the codebase.

### Scope

#### In `packages/schemas/src/review.ts`:
Rename all canonical types:
- `TriageSeveritySchema` → `ReviewSeveritySchema`
- `TriageSeverity` → `ReviewSeverity`
- `TriageCategorySchema` → `ReviewCategorySchema`
- `TriageCategory` → `ReviewCategory`
- `TriageIssueSchema` → `ReviewIssueSchema`
- `TriageIssue` → `ReviewIssue`
- `TriageResultSchema` → `ReviewResultSchema`
- `TriageResult` → `ReviewResult`
- `TriageErrorSchema` → `ReviewErrorSchema`
- `TriageError` → `ReviewError`
- `TriageStreamEventSchema` → `ReviewStreamEventSchema`
- `TriageStreamEvent` → `ReviewStreamEvent`
- `TriageOptionsSchema` → `ReviewOptionsSchema`
- `TriageOptions` → `ReviewOptions`
- Remove the alias exports at lines 159-163

#### In `packages/schemas/src/full-review-stream-event.ts`:
- `FullTriageStreamEventSchema` → `FullReviewStreamEventSchema`
- `FullTriageStreamEvent` → `FullReviewStreamEvent`

#### In `packages/schemas/src/review-storage.ts`:
- `SavedTriageReviewSchema` → `SavedReviewSchema` (if not already)
- Update internal references to use renamed types

#### In `packages/schemas/src/stream-events.ts`:
- If still exists: delete the file (it's superseded by `full-review-stream-event.ts`)
- If anything imports it, redirect to `full-review-stream-event.ts`

#### In `packages/schemas/src/step-event.ts`:
- Line 15: rename step ID `"triage"` → `"review"`, update label `"Triage issues"` → `"Review issues"`

#### In `packages/schemas/package.json`:
- Remove backward-compat subpath exports: `"./triage"`, `"./triage-storage"`, `"./full-triage-stream-event"`
- Or keep them temporarily and add deprecation comment

#### In `packages/schemas/src/index.ts`:
- Update all re-exports to use new names

#### In `packages/api/src/types.ts`:
- Rename: `TriageReviewMetadata` → `ReviewMetadata`
- Rename: `SavedTriageReview` → `SavedReview`
- Rename: `TriageReviewsResponse` → `ReviewsResponse`
- Rename: `TriageReviewResponse` → `ReviewResponse`
- Rename: `TriageContextResponse` → `ReviewContextResponse`
- Remove the aliased re-exports (`export type ReviewContextResponse = TriageContextResponse` etc.)

#### In all consumer files:
After renaming in schemas and api, update all imports across:
- `packages/core/src/` — especially `review/stream-review.ts`, `review/review-state.ts`, `review/filtering.ts`, `severity.ts`, `review/event-to-log.ts`, `review/agent-activity.ts`
- `apps/server/src/features/review/`, `pr-review/`, all shared modules
- `apps/web/src/features/review/`, `history/`

Search for any remaining `[Tt]riage` references with: `grep -ri "triage" --include="*.ts" --include="*.tsx"` and update each one.

#### In `apps/server/src/shared/lib/storage/reviews.ts`:
- Rename `TRIAGE_REVIEWS_DIR` constant → `REVIEWS_DIR`
- NOTE: The actual directory name on disk (`triage-reviews`) is a data migration concern. Add a comment noting the legacy directory name but don't rename the on-disk path (would break existing stored reviews).

---

## Phase 6: Fix Type Sharing (schemas as source of truth)

**Priority: MEDIUM**
**Goal:** Server and API client both derive types from `@diffgazer/schemas`. Remove duplicates.

### Current State

`packages/api/src/types.ts` (351 lines) redefines types that already exist as Zod schemas in `@diffgazer/schemas`:
- `AIProvider`, `ProviderStatus`, `TrustConfig`, `SettingsConfig`, `OpenRouterModel`, `ConfigCheckResponse`, `SaveConfigRequest`, etc.

The server imports from `@diffgazer/api` (its own client SDK) which is backwards.

### Instructions

1. In `packages/api/package.json`, add `@diffgazer/schemas` as a dependency
2. In `packages/api/src/types.ts`:
   - Replace hand-written interfaces with `z.infer<>` re-exports from schemas where possible
   - For types that don't have a Zod schema (HTTP response wrappers), keep as interfaces but import the domain types from schemas
   - Example: `export type ReviewIssue = z.infer<typeof ReviewIssueSchema>` (from schemas) instead of redefining
3. In `apps/server/src/features/*/types.ts`:
   - Import directly from `@diffgazer/schemas` instead of `@diffgazer/api`
   - Or remove these barrel re-export files if they add no value (config/types.ts, review/types.ts, pr-review/types.ts are just re-exports)

---

## Phase 7: Frontend React Fixes

**Priority: MEDIUM**
**Goal:** Fix React anti-patterns and simplify unnecessary memoization.

### 7a. ConfigProvider Context Value Not Memoized

**File:** `apps/web/src/app/providers/config-provider.tsx:243-258`

The context value object is recreated on every render, causing all consumers to re-render on any state change. Wrap in `useMemo`:

```tsx
const value = useMemo(() => ({
  provider, model, isConfigured, isLoading, isSaving, error,
  providerStatus, projectId, repoRoot, trust,
  refresh, activateProvider, saveCredentials, deleteProviderCredentials,
}), [provider, model, isConfigured, isLoading, isSaving, error,
  providerStatus, projectId, repoRoot, trust,
  refresh, activateProvider, saveCredentials, deleteProviderCredentials]);
```

### 7b. Remove Unnecessary useMemo

- `apps/web/src/app/routes/settings/diagnostics.tsx:40` — `useMemo(() => FOOTER_SHORTCUTS, [])` → just use `FOOTER_SHORTCUTS` directly (it's a module-level constant)
- `apps/web/src/app/routes/history.tsx:139-158` — `severityCounts` and `duration` useMemo do trivially cheap computations. Remove the useMemo wrappers.
- `apps/web/src/features/review/components/review-progress-view.tsx:77-107` — `shortcuts`, `rightShortcuts`, `agentStatusMeta` are memoized with `[]` deps. Move them to module-level constants instead.

### 7c. Dual State Sync via useEffect

**File:** `apps/web/src/app/routes/review.tsx:149-153`

```tsx
useEffect(() => {
  if (focusedIndex !== selectedIssueIndex) {
    setSelectedIssueIndex(focusedIndex);
  }
}, [focusedIndex, selectedIssueIndex, setSelectedIssueIndex]);
```

This syncs two state sources and causes double renders. Use a single source of truth — derive `selectedIssueIndex` from `focusedIndex` instead of syncing them via effect.

### 7d. Consolidate Effects in ReviewContainer

**File:** `apps/web/src/features/review/components/review-container.tsx`

9 separate useEffect hooks. Consolidate the two that both react to `state.isStreaming`:
```tsx
// Lines 126-131 (track streaming) and 132-137 (clear context on streaming)
// → Merge into single effect
useEffect(() => {
  if (state.isStreaming) {
    hasStreamedRef.current = true;
    setContextSnapshot(null);
    contextFetchRef.current = null;
  }
}, [state.isStreaming]);
```

### 7e. Missing Exhaustive Deps

**File:** `apps/web/src/features/providers/components/model-select-dialog/model-select-dialog.tsx:149-159`

The useEffect deps array is missing `resetFilters` and `models`. Add them or add an eslint-disable comment with explanation.

### 7f. Identical Ternary (Bug)

**File:** `apps/web/src/components/ui/severity/severity-filter-button.tsx:30-31`

```tsx
isActive ? config.color : config.color  // both branches identical
```

The inactive state should have a different/muted color.

---

## Phase 8: Server Cleanup

**Priority: LOW**
**Goal:** Standardize patterns and fix minor issues.

### 8a. Standardize Validation Pattern

Two patterns exist:
- Pattern A: `zValidator("json", schema, (result, c) => { if (!result.success) return invalidBodyResponse(c); })` — used in config/, settings/
- Pattern B: `zValidator("json", schema, zodErrorHandler)` — used in review/, sessions/, pr-review/

Standardize on Pattern B (`zodErrorHandler`) everywhere. Update `config/router.ts` and `settings/router.ts`.

### 8b. Extract `parseProjectPath`

Duplicated in `review/router.ts:277-286` and `sessions/router.ts:39-61`. Extract to `apps/server/src/shared/lib/http/request.ts` (or similar). Use the sessions version (more features). Simplify the return type to use standard `Result<T, E>` pattern.

### 8c. Add Body Limits to POST Routes

These POST routes lack `bodyLimitMiddleware`:
- `review/router.ts:367` — POST `/context/refresh`
- `review/router.ts:430` — POST `/reviews/:id/drilldown`
- `pr-review/router.ts:936` — POST `/`
- `sessions/router.ts:106,122,149` — multiple POST endpoints

Add `bodyLimitMiddleware` to each.

### 8d. Move `SSEWriter` Type

Currently in `apps/server/src/shared/lib/ai/client.ts:191-193`. Move to `apps/server/src/shared/lib/http/sse.ts` where it belongs.

### 8e. Consolidate `readJsonFile`

Three different implementations:
- `review/service.ts:493-500` (async)
- `shared/lib/config/state.ts:19-32` (sync)
- `shared/lib/ai/openrouter-models.ts:15-25` (sync)

Create a single `readJsonFile` in `shared/lib/fs.ts` with sync and async variants.

### 8f. Simplify `createErrorClassifier`

In `review/service.ts` and `diff-review/service.ts`: the `createErrorClassifier` is a generic factory used exactly once. Replace with a direct `classifyGitDiffError` function. After Phase 2, this goes into `shared/lib/git/errors.ts`.

### 8g. Remove TraceRecorder Class

`apps/server/src/features/review/router.ts:67-96` — replace with a simple array + `recordTrace` function. The class pattern is over-engineered for "push to array with timing". The `clear()` method is never called.

### 8h. Simplify Fake Progress Timer

`apps/server/src/features/review/service.ts:1138-1166` — has random jitter that adds no value. Use fixed-interval stages like `pr-review/router.ts:658-663`.

---

## Phase 9: Package Cleanup

**Priority: LOW**

### 9a. Delete Orphaned Files
- `packages/api/src/diff-review.ts` — not imported by `index.ts` or `bound.ts`
- `packages/schemas/src/stream-events.ts` — superseded by `full-review-stream-event.ts`

### 9b. Remove Feature-Level Type Barrel Files (Optional)
These files are just re-exports that add indirection:
- `apps/server/src/features/config/types.ts`
- `apps/server/src/features/review/types.ts`
- `apps/server/src/features/pr-review/types.ts`

If the feature service files already import directly from `@diffgazer/schemas`, these barrels add no value. Remove them and update imports.

---

## Verification Checklist

After all changes:

1. `pnpm install` — verify no dependency issues
2. `pnpm -F @diffgazer/schemas build` — schemas build
3. `pnpm -F @diffgazer/schemas test` — all schema tests pass
4. `pnpm -F @diffgazer/core build` — core builds with new schema names
5. `pnpm -F @diffgazer/api build` — api builds with new types
6. `pnpm -F server build` — server builds
7. `pnpm -F web build` — web builds
8. `grep -ri "triage" --include="*.ts" --include="*.tsx" apps/ packages/` — no remaining triage references (except possibly on-disk directory names in storage)
9. `pnpm test` — all tests pass
10. Manual test: start the server, run a review from the web UI, verify SSE streaming works
11. Manual test: run a PR review via the API endpoint

---

## Execution Order

Execute phases in this order to minimize conflicts:

1. **Phase 1** — Extract shared review engine (unblocks everything else)
2. **Phase 2** — Break up review/service.ts monolith
3. **Phase 3** — Clean up pr-review router
4. **Phase 4** — Merge diff-review into review
5. **Phase 5** — Complete triage→review rename (do this after structure is clean)
6. **Phase 6** — Fix type sharing
7. **Phase 7** — Frontend React fixes
8. **Phase 8** — Server cleanup
9. **Phase 9** — Package cleanup

Phases 7-9 are independent and can run in parallel after Phase 6.
