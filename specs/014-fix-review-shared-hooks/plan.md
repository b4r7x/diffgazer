# Implementation Plan: Fix Review Regression & Consolidate Shared Review Hooks

**Branch**: `014-fix-review-shared-hooks` | **Date**: 2026-03-25 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/014-fix-review-shared-hooks/spec.md`

## Summary

Fix two critical review regressions (web hangs due to resume silently resetting state, CLI hangs due to start() being a mode-setter no-op) introduced by branch 013. Consolidate the near-identical `useReviewStart` (~90% shared) and `useReviewCompletion` (~60% shared) hooks into `@diffgazer/api/hooks`, extract shared derived-state functions into `@diffgazer/core/review`, and clean up dead code and unstable effect dependencies.

## Technical Context

**Language/Version**: TypeScript 5.x (strict: true), ESM only, .js extensions in imports
**Primary Dependencies**: React 19, TanStack Query v5, Ink 6 (CLI), Vite 7 (web), Zod 4
**Storage**: N/A (API calls to Hono backend, no direct storage changes)
**Testing**: vitest (unit/integration), manual E2E (web + CLI review flows)
**Target Platform**: Node.js 20+ (CLI/server), browser (web)
**Project Type**: Monorepo with shared packages + two app frontends (web + CLI)
**Performance Goals**: Review start-to-stream latency unchanged; no new re-renders from unstable deps
**Constraints**: React Compiler NOT active (confirmed) -- manual referential stability required; no `useCallback`/`useMemo` per project convention (use ref-based stable callback pattern instead)
**Scale/Scope**: ~15 files modified, ~3 new files, ~5 files deleted

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Constitution is an unfilled template -- no project-specific gates defined. Proceeding.

**Post-Phase-1 re-check**: No violations. The design follows existing patterns (shared hooks in `@diffgazer/api/hooks`, pure functions in `@diffgazer/core/review`), does not add new packages or architectural layers, and maintains backwards compatibility.

## Project Structure

### Documentation (this feature)

```text
specs/014-fix-review-shared-hooks/
  plan.md              # This file
  spec.md              # Feature specification
  research.md          # Phase 0 research findings
  data-model.md        # Entity and interface definitions
  quickstart.md        # Build/test/verify instructions
  contracts/
    shared-review-hooks.md  # API contracts for new/modified exports
  checklists/
    requirements.md    # Specification quality checklist
```

### Source Code (repository root)

```text
packages/api/src/hooks/
  use-review-stream.ts        # MODIFY: restore Result return on resume
  use-review-start.ts         # NEW: shared start/resume orchestration
  use-review-completion.ts    # NEW: shared completion detection
  index.ts                    # MODIFY: add new exports

packages/core/src/review/
  lifecycle-helpers.ts         # NEW: isNoDiffError, isCheckingForChanges, getLoadingMessage
  index.ts                     # MODIFY: add new exports

apps/web/src/features/review/hooks/
  use-review-start.ts          # DELETE: replaced by shared
  use-review-completion.ts     # DELETE: replaced by shared (if exists)
  use-review-lifecycle.ts      # MODIFY: consume shared hooks + pure functions

apps/cli/src/features/review/hooks/
  use-review-start.ts          # DELETE: replaced by shared
  use-review-completion.ts     # DELETE: replaced by shared
  use-review-lifecycle.ts      # MODIFY: consume shared hooks + pure functions

apps/cli/src/app/screens/
  status-screen.tsx            # DELETE: dead code (not in router)
```

**Structure Decision**: No new packages or directories beyond what already exists. New shared hooks follow the established pattern in `packages/api/src/hooks/` (alongside `use-review-stream.ts` and `diagnostics.ts`). New pure functions follow the pattern in `packages/core/src/review/` (alongside `lenses.ts` and `display.ts`).

## Implementation Phases

### Phase 1: Fix Critical Bugs (P1 -- Web + CLI Review)

**Goal**: Get both review flows working again. Minimal changes, fix root causes only.

#### Step 1.1: Restore Result return type on useReviewStream.resume

**File**: `packages/api/src/hooks/use-review-stream.ts`

**Changes**:
- Change `resume` return type from `Promise<void>` to `Promise<Result<void, StreamReviewError>>`
- For `SESSION_STALE` / `SESSION_NOT_FOUND`: return the error Result, do NOT dispatch RESET or ERROR
- For other `Result.error`: dispatch ERROR internally AND return the error Result
- For success: dispatch SET_REVIEW_ID, stream events, dispatch COMPLETE, return `ok(undefined)`
- Import `Result`, `ok`, `err` from `@diffgazer/core/result` and `StreamReviewError` from `@diffgazer/core/review`

#### Step 1.2: Fix web useReviewStart to handle resume errors

**File**: `apps/web/src/features/review/hooks/use-review-start.ts`

**Changes**:
- Update `resume` type in options to `(id: string) => Promise<Result<void, StreamReviewError>>`
- When `resume(reviewId)` returns `SESSION_STALE`: call `start({ mode, lenses })` (fresh start)
- When `resume(reviewId)` returns `SESSION_NOT_FOUND`: call `onNotFoundInSession?.(reviewId)` callback (to be restored in lifecycle)
- Same error handling for `getActiveSession` -> `resume(session.reviewId)` path

**File**: `apps/web/src/features/review/hooks/use-review-lifecycle.ts`

**Changes**:
- Restore `onReviewNotInSession` callback support (or equivalent) for the SESSION_NOT_FOUND case
- Pass it through to `useReviewStart`

#### Step 1.3: Fix CLI start() to actually trigger the stream

**File**: `apps/cli/src/features/review/hooks/use-review-lifecycle.ts`

**Changes**:
- The `start()` function must directly initiate the review, not just call `setMode()`
- Approach: have `start()` set mode AND set a `startRequested` state flag (or increment a counter) that triggers the start effect
- OR: restructure so `useReviewStart` exposes an imperative `startReview()` function

#### Step 1.4: Fix CLI hasStreamed stale read

**File**: `apps/cli/src/features/review/hooks/use-review-lifecycle.ts`

**Changes**:
- Convert `hasStreamedRef` to `useState<boolean>(false)` (call it `hasStreamed` / `setHasStreamed`)
- Update `useReviewStart` to use state setter instead of ref mutation
- Pass `hasStreamed` boolean (now reactive) to `useReviewCompletion`

#### Step 1.5: Fix unstable effect dependencies

**Files**: Both apps' `use-review-start.ts`

**Changes**:
- Store `start`, `resume`, `getActiveSession` functions in refs (updated via `useEffect` or direct assignment)
- Read from refs inside the start effect
- Remove the functions from the effect dependency array
- Same pattern for `defaultLenses` (store in ref, read from ref)

**Verification**: After Phase 1, both `pnpm dev:web` and `pnpm dev:cli` review flows complete end-to-end.

---

### Phase 2: Consolidate Shared Hooks (P2)

**Goal**: Eliminate duplication. Single source of truth for start and completion logic.

#### Step 2.1: Create shared useReviewStart

**File**: `packages/api/src/hooks/use-review-start.ts` (NEW)

**Implementation**:
- Accept `UseReviewStartOptions` (see contracts/shared-review-hooks.md)
- Expose imperative `startReview()` function
- Return `{ startReview, hasStarted, hasStreamed }` as reactive state (not refs)
- Handle `reviewId` (optional): when provided, resume directly; when absent, check active session
- Handle resume Result errors: SESSION_STALE -> start fresh, SESSION_NOT_FOUND -> return error status
- Use ref-based stable callback pattern for injected functions

#### Step 2.2: Create shared useReviewCompletion

**File**: `packages/api/src/hooks/use-review-completion.ts` (NEW)

**Implementation**:
- Accept `UseReviewCompletionOptions` (see contracts/shared-review-hooks.md)
- Detect `isStreaming` true->false transition
- Compute delay from report step status
- Call `onComplete()` after delay
- Return `{ isCompleting, skipDelay, reset }`
- Store `onComplete` in ref for stable reference

#### Step 2.3: Extract shared lifecycle helpers

**File**: `packages/core/src/review/lifecycle-helpers.ts` (NEW)

**Functions**:
- `isNoDiffError(error: string | null): boolean`
- `isCheckingForChanges(isStreaming: boolean, steps: StepState[]): boolean`
- `getLoadingMessage(opts): string | null` -- accepts config/settings loading booleans, returns message

**File**: `packages/core/src/review/index.ts` -- add exports

#### Step 2.4: Update web lifecycle to consume shared hooks

**File**: `apps/web/src/features/review/hooks/use-review-lifecycle.ts`

**Changes**:
- Import `useReviewStart`, `useReviewCompletion` from `@diffgazer/api/hooks`
- Import `isNoDiffError`, `isCheckingForChanges`, `getLoadingMessage` from `@diffgazer/core/review`
- Remove local start/completion logic, wire shared hooks with web-specific callbacks
- Web completion `onComplete`: push `{ issues, reviewId }` to parent via existing callback

**Delete**: `apps/web/src/features/review/hooks/use-review-start.ts`
**Delete**: `apps/web/src/features/review/hooks/use-review-completion.ts` (if exists as separate file)

#### Step 2.5: Update CLI lifecycle to consume shared hooks

**File**: `apps/cli/src/features/review/hooks/use-review-lifecycle.ts`

**Changes**:
- Import `useReviewStart`, `useReviewCompletion` from `@diffgazer/api/hooks`
- Import `isNoDiffError`, `isCheckingForChanges`, `getLoadingMessage` from `@diffgazer/core/review`
- Remove local start/completion logic, wire shared hooks
- CLI completion `onComplete`: set phase to `"summary"`
- Derive `isCompleting` into CLI's phase machine

**Delete**: `apps/cli/src/features/review/hooks/use-review-start.ts`
**Delete**: `apps/cli/src/features/review/hooks/use-review-completion.ts`

#### Step 2.6: Update barrel exports

**File**: `packages/api/src/hooks/index.ts`

**Add exports**:
- `useReviewStart`, `type UseReviewStartOptions`, `type UseReviewStartResult`
- `useReviewCompletion`, `type UseReviewCompletionOptions`, `type UseReviewCompletionResult`

**Verification**: `pnpm build && pnpm type-check`. Both apps import from shared package. Both review flows still work.

---

### Phase 3: Quality Cleanup (P3)

**Goal**: Remove dead code, document display divergence, ensure quality.

#### Step 3.1: Remove dead code

- Delete `apps/cli/src/app/screens/status-screen.tsx` (not in router, unused)
- Verify no other files reference it

#### Step 3.2: Document display.ts scope

- Add a comment to `packages/core/src/review/display.ts` documenting that `mapStepStatus` and `getAgentDetail` use CLI naming conventions (`running`/`complete`/`error`) vs web's schema-aligned names (`active`/`completed`/`pending`)
- OR: rename to `cli-display.ts` if the web will never consume it

#### Step 3.3: Final audit pass

- Verify zero unstable function references in effect dependency arrays
- Verify zero dead exports in shared packages
- Verify no duplicated logic between web and CLI review hooks
- Verify barrel exports are complete and types are re-exported

## Complexity Tracking

No constitution violations to justify. The design adds 3 new files to existing packages, deletes 5 app-specific files, and modifies ~7 existing files. No new packages, no new architectural patterns.
