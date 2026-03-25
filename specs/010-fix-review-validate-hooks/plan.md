# Implementation Plan: Fix Web Review Regression & Hooks Quality Finalization

**Branch**: `010-fix-review-validate-hooks` | **Date**: 2026-03-25 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/010-fix-review-validate-hooks/spec.md`

## Summary

Fix the web (and CLI) review regression caused by commit `9c4c807` which removed the resume-to-fresh-start fallback from `use-review-start.ts`. Restore the `Result` return type on `useReviewStream.resume()`, add error handling in both app consumers, fix the false completion trigger in both apps, update stale tests, fix hooks quality warnings (manual query key, unnecessary comments, docs drift), and expand matchQueryState adoption across ~10 components.

## Technical Context

**Language/Version**: TypeScript 5.x (strict: true), ESM only, `.js` extensions in imports
**Primary Dependencies**: React 19, TanStack Query v5, Ink 6 (CLI), Vite 7 (web)
**Storage**: N/A (in-memory query cache, no persistence changes)
**Testing**: vitest, `@testing-library/react`
**Target Platform**: Node.js (CLI via Ink) + Browser (web via Vite)
**Project Type**: Shared React hooks library + dual-platform consumer apps
**Performance Goals**: Resume→fallback→fresh-start in under 3 seconds
**Constraints**: Zero new dependencies, backward-compatible resume return type, both platforms must continue working
**Scale/Scope**: ~15 files modified across 3 packages, ~10 components converted to matchQueryState

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Constitution is a template with no project-specific gates. No violations possible. Gate passes.

**Post-Phase 1 re-check**: No violations. Changes are bug fixes, quality improvements, and adoption consistency within existing packages. No new abstractions, no new dependencies.

## Project Structure

### Documentation (this feature)

```text
specs/010-fix-review-validate-hooks/
├── plan.md              # This file
├── spec.md              # Feature specification
├── research.md          # Root cause analysis, fix approach, quality audit
├── data-model.md        # Code change specifications
├── quickstart.md        # Implementation guide
├── checklists/
│   └── requirements.md  # Spec quality checklist
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

### Source Code (repository root)

```text
packages/api/src/hooks/
├── use-review-stream.ts          # MODIFIED — resume returns Result<void, StreamReviewError>
├── review.ts                     # MODIFIED — useDeleteReview uses factory for query key
├── config.ts                     # MODIFIED — remove section comments
├── index.ts                      # MODIFIED — export StreamReviewError type, remove section comments

apps/web/src/features/review/hooks/
├── use-review-start.ts           # MODIFIED — await resume result, handle stale/not-found
├── use-review-start.test.ts      # MODIFIED — update to match current API
├── use-review-completion.ts      # MODIFIED — add reviewId guard to completion check

apps/cli/src/features/review/hooks/
└── use-review-lifecycle.ts       # MODIFIED — await resume result, add reviewId completion guard

apps/cli/src/features/*/          # MODIFIED — ~8 files converted to matchQueryState
apps/cli/src/app/screens/*/       # (part of matchQueryState adoption)
apps/web/src/features/*/          # MODIFIED — ~2 files converted to matchQueryState

.claude/docs/shared-hooks.md      # MODIFIED — remove batchEvents, add matchQueryState docs, fix file tree
```

**Structure Decision**: All changes are within existing files and directories. No new files created (except possibly a new test file for useReviewCompletion). No new directories. The fix touches 3 layers: shared hooks package, web app consumer, CLI app consumer.

## Implementation Phases

### Phase 1: Fix Resume Fallback + Completion Guard (P1 — Critical Regression)

Two bugs, one root cause. Fix the shared hook first, then both consumers.

**1a. Shared hook: Resume returns Result**

File: `packages/api/src/hooks/use-review-stream.ts`

Change `resume` signature from `Promise<void>` to `Promise<Result<void, StreamReviewError>>`. The function body stays the same (still dispatches START/RESET/ERROR/COMPLETE). Add `return result;` at the end of each branch in the try block. Import `Result` from `@diffgazer/core/result` and `StreamReviewError` from `../review.js`.

File: `packages/api/src/hooks/index.ts`

Add type re-export: `export type { StreamReviewError } from "../review.js";`

**1b. Web consumer: Handle resume failure**

File: `apps/web/src/features/review/hooks/use-review-start.ts`

Change the two `void resume(id)` calls to `await resume(id)` and check the result:
- If `result.ok` — do nothing (resume succeeded)
- If `result.error.code === SESSION_STALE` or `SESSION_NOT_FOUND` — call `startFresh()`
- Other errors — shared hook already dispatched ERROR, UI handles it

Import `ReviewErrorCode` from `@diffgazer/schemas/review`.

**1c. CLI consumer: Handle resume failure**

File: `apps/cli/src/features/review/hooks/use-review-lifecycle.ts`

Change `void stream.resume(activeReviewId)` (line 122) to:
```typescript
const result = await stream.resume(activeReviewId);
if (!result.ok) { startFresh(); }
```

**1d. Web completion guard**

File: `apps/web/src/features/review/hooks/use-review-completion.ts`

Line 42: Add `&& reviewIdRef.current !== null` to the guard condition.

**1e. CLI completion guard**

File: `apps/cli/src/features/review/hooks/use-review-lifecycle.ts`

Line 146: Add `&& stream.state.reviewId !== null` to the guard condition.

### Phase 2: Update Stale Tests (P1)

File: `apps/web/src/features/review/hooks/use-review-start.test.ts`

The test file already expects the Result-returning resume API. The tests need:
- Remove `onNotFoundInSession` from defaultProps (it no longer exists)
- Update `resume` mock return types to match `Result<void, StreamReviewError>`
- Verify tests 1-3 (basic start, resume, auto-resume) pass
- Verify tests 4-6 (stale fallback, not-found fallback) pass with the new implementation
- Remove or update test 7 (onNotFoundInSession) since that callback was removed

### Phase 3: Hooks Quality Fixes (P1)

**3a. Query key factory usage**

File: `packages/api/src/hooks/review.ts:32`

Change `qc.removeQueries({ queryKey: [...reviewQueries.all(), id] })` to `qc.removeQueries({ queryKey: reviewQueries.detail(api, id).queryKey })`.

**3b. Remove unnecessary comments**

File: `packages/api/src/hooks/config.ts` — Remove `// Query hooks` and `// Mutation hooks` comments.
File: `packages/api/src/hooks/index.ts` — Remove all section comments (`// Context`, `// Config domain`, etc.).

### Phase 4: matchQueryState Adoption (P2)

Convert ~10 components from manual `if (isLoading) return ... if (error) return ...` guards to `matchQueryState`. Each conversion is independent (different files, no dependencies).

**CLI candidates** (8 files):
1. `apps/cli/src/features/onboarding/components/steps/provider-step.tsx`
2. `apps/cli/src/features/onboarding/components/steps/model-step.tsx`
3. `apps/cli/src/app/screens/settings/providers-screen.tsx`
4. `apps/cli/src/app/screens/settings/agent-execution-screen.tsx`
5. `apps/cli/src/app/screens/settings/analysis-screen.tsx`
6. `apps/cli/src/app/screens/settings/storage-screen.tsx`
7. `apps/cli/src/app/screens/settings/trust-permissions-screen.tsx`
8. `apps/cli/src/features/home/components/trust-panel.tsx`

**Web candidates** (2 files):
1. `apps/web/src/features/settings/components/agent-execution/page.tsx`
2. `apps/web/src/features/settings/components/storage/page.tsx`

Each conversion: import `matchQueryState` from `@diffgazer/api/hooks`, replace the manual guard with `const guard = matchQueryState(query, { loading, error, success }); if (guard) return guard;`. Pass the raw `UseQueryResult` where currently destructured.

### Phase 5: Documentation Update (P3)

File: `.claude/docs/shared-hooks.md`

1. Remove `batchEvents` callback reference from useReviewStream section
2. Add matchQueryState section: check order (data-first), guard clause pattern, platform compatibility
3. Update architecture file tree to match post-consolidation structure
4. Update useReviewStream section to document the `Result` return type from `resume()`
5. Update "What Still Uses Direct API Calls" if any changes

### Phase 6: Verification

1. Type-check: `pnpm run type-check`
2. Build both apps: `pnpm build`
3. Run tests: `cd apps/web && pnpm test` (verify use-review-start tests pass)
4. Manual verification: start server, run a review, make changes, run another review — verify the stale session fallback works

## Parallelism Strategy

**Maximum parallelism: 12 agents**

Phase 1 (5 files, partially parallelizable):
- **Agent 1**: Phase 1a — shared hook change (must complete first for type changes)
- **Agents 2-5**: Phase 1b-1e — web start, CLI lifecycle, web completion, CLI completion (parallel after Agent 1)

Phase 2 (1 file):
- **Agent 6**: Update stale tests (after Phase 1b)

Phase 3 (2 files, parallel):
- **Agent 7**: Query key fix in review.ts
- **Agent 8**: Remove comments from config.ts + index.ts

Phase 4 (10 files, all parallel):
- **Agents 9-18**: One agent per matchQueryState conversion (or batch 2-3 per agent)
- Can run in parallel with Phase 2-3 since they touch different files

Phase 5 (1 file):
- **Agent 19**: Documentation update (after all code changes)

Phase 6 (verification):
- **Agent 20**: Build, type-check, test (after all phases)

**Realistic allocation: 6-8 agents** with batching:
- Agent 1: Phase 1a (shared hook)
- Agent 2: Phase 1b + 1d (web review hooks)
- Agent 3: Phase 1c + 1e (CLI review hooks)
- Agent 4: Phase 2 (tests)
- Agent 5: Phase 3 (quality fixes)
- Agent 6-8: Phase 4 (matchQueryState, 3-4 files each)
- Agent 9: Phase 5 + 6 (docs + verification)

## Complexity Tracking

No constitution violations. No complexity justifications needed.
