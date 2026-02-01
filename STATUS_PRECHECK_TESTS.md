# Status Pre-check Tests - Quick Reference

## What's Being Tested

The `ReviewPage` component has a `useEffect` that runs when a `reviewId` parameter exists. This effect:
1. Checks if a completed review already exists
2. If found, loads it and shows the results view
3. If not found, falls through to the progress view
4. Only runs once per reviewId to avoid redundant API calls

## Test File Location

```
apps/web/src/app/pages/review.test.tsx
```

## 5 Required Test Cases

### 1️⃣ Shows "Checking review..." while isCheckingStatus is true
**Line:** 612-643

Tests that the loading message is displayed during the API call.

```typescript
it("shows 'Checking review...' while isCheckingStatus is true", async () => {
  // Mocks slow API to see loading state
  // Verifies displayText becomes "Checking review..."
  // Confirms isCheckingStatus is false after
})
```

### 2️⃣ Sets view to "results" when completed review found
**Line:** 647-673

Tests the happy path - review exists and is loaded successfully.

```typescript
it("sets view to 'results' when completed review found", async () => {
  // Mock successful API response
  // Simulate useEffect logic
  // Verify view becomes "results"
  // Verify reviewData is populated correctly
})
```

### 3️⃣ Proceeds to progress view when review not found
**Line:** 675-693

Tests the fallback - review doesn't exist, stays in progress view.

```typescript
it("proceeds to progress view when review not found", async () => {
  // Mock API rejection
  // Verify view stays as "progress"
  // Verify error handling doesn't crash
})
```

### 4️⃣ Does not check status when no reviewId in params
**Line:** 718-727

Tests the guard that prevents unnecessary API calls.

```typescript
it("does not check status when no reviewId in params", () => {
  // Verify getTriageReview is NOT called
  // Tests: if (!params.reviewId) return;
})
```

### 5️⃣ Only checks once (doesn't re-run on every render)
**Line:** 729-756

Tests the guard that prevents redundant API calls across re-renders.

```typescript
it("only checks once (doesn't re-run on every render)", async () => {
  // Simulate multiple renders
  // Verify API called exactly once
  // Tests: if (reviewData.reviewId === null) checkStatus()
})
```

## Code Being Tested

```typescript
// From review.tsx lines 253-279
useEffect(() => {
  if (!params.reviewId) return;  // Guard #1

  const checkStatus = async () => {
    setIsCheckingStatus(true);
    try {
      const { review } = await getTriageReview(api, params.reviewId!);
      setReviewData({
        issues: review.result.issues,
        reviewId: review.metadata.id,
        error: null,
      });
      setView("results");  // Key: Jump to results if found
    } catch {
      // Not completed - will proceed to progress view
    } finally {
      setIsCheckingStatus(false);
    }
  };

  // Guard #2: Only check if we haven't already loaded data
  if (reviewData.reviewId === null) {
    checkStatus();
  }
}, [params.reviewId]);  // Dependency: Only re-run if reviewId changes
```

## Mock Strategy

```typescript
const mockApiModule = vi.hoisted(() => ({
  getTriageReview: vi.fn(),
}));

// In tests:
mockApiModule.getTriageReview.mockResolvedValueOnce({
  review: createMockReview(),
});

// Or for errors:
mockApiModule.getTriageReview.mockRejectedValueOnce(
  new Error("Not found")
);
```

## Running Specific Tests

```bash
# Run all status pre-check tests
npx vitest apps/web/src/app/pages/review.test.tsx -t "Status Pre-check"

# Run single test
npx vitest apps/web/src/app/pages/review.test.tsx -t "shows 'Checking review'"

# Watch mode
npx vitest apps/web/src/app/pages/review.test.tsx --watch
```

## Test Coverage Summary

| Test | Purpose | Status |
|------|---------|--------|
| Loading state | UI shows "Checking review..." | ✅ Covered |
| View transition (success) | Jump to results on found | ✅ Covered |
| View transition (failure) | Stay in progress on not found | ✅ Covered |
| No params guard | Skip check if no reviewId | ✅ Covered |
| Single execution | Only run once via guards | ✅ Covered |
| Dependency array | Only re-run on reviewId change | ✅ Covered |
| Data flow | Correct state population | ✅ Covered |
| Error handling | Graceful error recovery | ✅ Covered |
| Integration | Full flow from params to view | ✅ Covered |

## Key Insights

1. **Two Guards Prevent Redundant Calls:**
   - `if (!params.reviewId) return;` - Skip if no param
   - `if (reviewData.reviewId === null)` - Skip if already loaded

2. **Dependency Array Optimization:**
   - `[params.reviewId]` means effect only re-runs when reviewId changes
   - Same reviewId = effect doesn't re-run

3. **Error Handling Philosophy:**
   - Errors don't set error state or display
   - Instead, silently falls through to progress view
   - User can then run a new review or resume

4. **Fast Path for Completed Reviews:**
   - Skip entire ReviewContainer component
   - Jump straight to results view
   - Saves time for reviewing previously completed work

## Integration with Existing Tests

The test file already contains comprehensive tests for `useScopedRouteState` (561 lines before this section). The new status pre-check tests add 270+ lines of coverage for the useEffect logic.

Both test suites are independent and can run in parallel.
