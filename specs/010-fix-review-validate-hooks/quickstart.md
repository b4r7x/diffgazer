# Quickstart: Fix Web Review Regression & Hooks Quality

## Pre-Implementation Checklist

- [ ] Read `research.md` — root cause analysis, fix approach, quality audit findings
- [ ] Read `data-model.md` — exact code changes for resume fix and completion guard
- [ ] Verify you're on branch `010-fix-review-validate-hooks`

## Priority Order

### 1. Fix Resume Fallback (P1 — the critical regression)

**Shared hook** (`packages/api/src/hooks/use-review-stream.ts`):
- Change `resume` return type to `Promise<Result<void, StreamReviewError>>`
- Add `return result;` at end of each branch in the try block
- Export `StreamReviewError` type from `packages/api/src/hooks/index.ts`

**Web consumer** (`apps/web/src/features/review/hooks/use-review-start.ts`):
- Await resume result instead of fire-and-forget
- On SESSION_STALE or SESSION_NOT_FOUND: call `startFresh()`
- Import `ReviewErrorCode` from `@diffgazer/schemas/review`

**CLI consumer** (`apps/cli/src/features/review/hooks/use-review-lifecycle.ts`):
- Await resume result
- On any failure: call `startFresh()`

### 2. Fix Completion False Trigger (P1 — companion bug)

**Web** (`apps/web/src/features/review/hooks/use-review-completion.ts:42`):
- Add `&& reviewIdRef.current !== null` to guard condition

**CLI** (`apps/cli/src/features/review/hooks/use-review-lifecycle.ts:146`):
- Add `&& stream.state.reviewId !== null` to guard condition

### 3. Update Stale Tests (P1)

**File**: `apps/web/src/features/review/hooks/use-review-start.test.ts`
- Update `resume` mock to return Result
- Tests 4-7 already test the resume-fallback behavior
- Add test for the `onNotFoundInSession` callback if re-added

### 4. Hooks Quality Fixes (P1)

**Query key**: `packages/api/src/hooks/review.ts:32`
- Change `[...reviewQueries.all(), id]` to `reviewQueries.detail(api, id).queryKey`

**Comments**: Remove unnecessary section comments from `config.ts` and `index.ts`

### 5. matchQueryState Adoption (P2)

Convert ~10 candidate components from manual guards to matchQueryState. See `research.md` for full list.

### 6. Documentation Update (P3)

Update `.claude/docs/shared-hooks.md`:
- Remove batchEvents reference
- Add matchQueryState documentation
- Update file tree to match post-consolidation structure

## Verification

```bash
pnpm run type-check
pnpm build
# Start server and test review flow manually:
# 1. Run a review → let it complete
# 2. Make a code change
# 3. Run another review → should auto-fallback to fresh start
```
