# Gap Fixer Workflow - Final Implementation Fixes

## Overview

This workflow fixes the remaining gaps in the Stargazer implementation. The project is 95%+ complete - only minor fixes needed.

---

## Project Context

**Already Implemented:**
- Vercel AI SDK (`ai`, `@ai-sdk/google`, `@ai-sdk/openai`, `@ai-sdk/anthropic`)
- Review engine: triage.ts, drilldown.ts, lenses/, profiles.ts
- CLI: commands/review.ts, features/review/apps/, features/review/components/
- Storage: .stargazer/triage-reviews/
- Server: /triage/* routes
- Documentation: /docs/

**Gaps to Fix:**
1. `handleApplyFix` is a stub - needs real patch application
2. `--files` option defined but not used
3. `reviewId` not set after triage - drilldown broken
4. Review screens in wrong location (minor, optional)

---

## FIX 1: ReviewId Bug (CRITICAL)

**File:** `apps/cli/src/features/review/apps/interactive-review-app.tsx`

**Problem:** `reviewId` state is never set after triage completes, so drilldown cannot work.

**Fix:**
```typescript
// In the triage completion callback, capture the reviewId from save response
// The triageReviewStore.save() returns the id - pass it back via SSE or callback
```

**Steps:**
1. Read `apps/cli/src/features/review/apps/interactive-review-app.tsx`
2. Find where triage completes and results are set
3. The `triageReviewStore.save()` in server returns an id
4. Ensure the SSE stream or callback includes this id
5. Set `setReviewId(id)` when triage completes
6. Verify drilldown works after fix

---

## FIX 2: Apply Patch Implementation (HIGH)

**File:** `apps/cli/src/features/review/apps/interactive-review-app.tsx`

**Problem:** `handleApplyFix` just logs, doesn't apply patch.

**Current code:**
```typescript
const handleApplyFix = useCallback((issue: TriageIssue) => {
  const patch = issue.suggested_patch;
  if (!patch) return;
  console.log("Applying patch for issue:", issue.id);  // stub
}, []);
```

**Fix - implement actual patch application:**
```typescript
const handleApplyFix = useCallback(async (issue: TriageIssue) => {
  const patch = issue.suggested_patch;
  if (!patch) return;

  // Parse the unified diff patch
  // Apply to file using fs operations
  // Show success/failure feedback
  // Mark issue as 'applied' in state
}, []);
```

**Steps:**
1. Read the current `handleApplyFix` implementation
2. Check if there's a patch utility in `packages/core/src/diff/`
3. Implement patch parsing and application
4. Add user feedback (success/error messages)
5. Update issue state to 'applied'

---

## FIX 3: --files Option (MEDIUM)

**File:** `apps/cli/src/commands/review.ts`

**Problem:** `--files` option is in interface but not used.

**Steps:**
1. Read `apps/cli/src/commands/review.ts`
2. Find where options are parsed
3. If `options.files` is provided:
   - Filter diff to only those files
   - OR pass file list to triage endpoint
4. Test with: `stargazer review --files src/index.ts,src/app.ts`

---

## FIX 4: Screen Location (LOW - Optional)

**Current:** Review screens in `apps/cli/src/features/review/components/`
**Expected:** `apps/cli/src/app/screens/`

This is a minor structural inconsistency. The current location works but doesn't follow the Bulletproof React pattern exactly.

**Decision:** Skip unless other fixes reveal issues. The feature-based organization is also valid.

---

## Execution

### Agent 1: Fix ReviewId Bug + Apply Patch
```
subagent_type: "react-component-architect"

Task: Fix the reviewId bug and implement apply patch in interactive-review-app.tsx

Files to read:
- apps/cli/src/features/review/apps/interactive-review-app.tsx
- apps/cli/src/features/review/hooks/use-triage.ts
- packages/core/src/storage/review-storage.ts
- apps/server/src/api/routes/triage.ts

Fix 1 - ReviewId:
1. Trace how triage results flow from server to CLI
2. Find where triageReviewStore.save() is called
3. Ensure the saved review's id is returned via SSE stream
4. In CLI, capture this id and call setReviewId()
5. Verify drilldown button works after

Fix 2 - Apply Patch:
1. Check if packages/core/src/diff/ has patch utilities
2. If not, implement simple unified diff application:
   - Parse the patch string
   - Read target file
   - Apply hunks
   - Write file
3. Add error handling and user feedback
4. Mark issue as applied in local state

Run: npm run type-check
Test: Run review on a file, try drilldown, try apply patch
```

### Agent 2: Fix --files Option
```
subagent_type: "javascript-typescript:typescript-pro"

Task: Implement the --files option in review command

Files to read:
- apps/cli/src/commands/review.ts
- apps/cli/src/features/review/apps/interactive-review-app.tsx

Steps:
1. Find where ReviewCommandOptions.files is defined
2. Pass files filter to the review app
3. Either filter diff client-side or pass to server
4. Test: stargazer review --files src/index.ts

Run: npm run type-check
```

---

## Validation

After fixes:
1. `npm run type-check` - must pass
2. `npx vitest run` - must pass
3. Manual test:
   - Run `stargazer review`
   - Wait for triage to complete
   - Click drilldown on an issue - should work now
   - Click apply on an issue with patch - should apply
   - Run `stargazer review --files <file>` - should filter

---

## Expected Output

1. ✅ ReviewId properly set after triage
2. ✅ Drilldown works
3. ✅ Apply patch actually applies the patch
4. ✅ --files option filters review scope
5. ✅ All tests pass
