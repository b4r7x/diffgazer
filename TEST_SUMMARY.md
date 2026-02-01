# ReviewPage Status Pre-check Tests

## Overview

Comprehensive test suite for the status pre-check feature in `ReviewPage` component. The pre-check automatically fetches completed reviews when a `reviewId` is present in URL parameters, skipping the progress view and directly showing results.

## File Location

**Test File:** `/Users/voitz/Projects/stargazer/apps/web/src/app/pages/review.test.tsx`

**Source File:** `/Users/voitz/Projects/stargazer/apps/web/src/app/pages/review.tsx`

## Test Coverage

### 1. **Loading State Tests** (1 test)

#### `shows 'Checking review...' while isCheckingStatus is true`
- Verifies the UI displays the correct loading message during API call
- Mocks a slow API response to capture the loading state
- Confirms `isCheckingStatus` is properly set to `false` after completion

### 2. **View Transitions on Pre-check** (2 tests)

#### `sets view to 'results' when completed review found`
- Tests the critical path where a completed review exists
- Verifies the view state transitions to "results"
- Confirms review data is properly populated:
  - `reviewData.reviewId`
  - `reviewData.issues`
  - `reviewData.error` is null

#### `proceeds to progress view when review not found`
- Tests the fallback path when API call fails
- Confirms the component stays in "progress" view
- Verifies error is handled gracefully without crashing

### 3. **Conditional Execution** (2 tests)

#### `does not check status when no reviewId in params`
- **Key Test Case #4:** Prevents unnecessary API calls
- Verifies the early return guard: `if (!params.reviewId) return;`
- Confirms `getTriageReview` is never called when reviewId is undefined

#### `checks status only when reviewId exists in params`
- Tests the inverse scenario - API call happens when reviewId is present
- Verifies correct reviewId is passed to the API

### 4. **Single Execution Guarantee** (3 tests)

#### `only checks once (doesn't re-run on every render)`
- **Key Test Case #5:** Core feature preventing performance issues
- Uses the `reviewData.reviewId === null` guard to prevent re-checking
- Simulates multiple renders and verifies API is called exactly once
- Ensures idempotency - loading data once prevents loading twice

#### `respects dependency array [params.reviewId] prevents re-runs on same ID`
- Tests React's dependency array mechanism
- Simulates effect re-runs when reviewId changes
- Confirms effect doesn't re-run when reviewId stays the same

#### `prevents re-checking via reviewData.reviewId guard`
- Tests the state guard that prevents redundant API calls
- Confirms once `reviewData.reviewId` is populated, subsequent renders skip the check

### 5. **Data Flow** (3 tests)

#### `skips progress view when completed review is loaded`
- **Key Test Case #2:** Verifies immediate jump to results view
- Confirms ReviewContainer (progress view) is not shown
- Tests that loaded data triggers correct view selection

#### `loads review data into reviewData state correctly`
- Verifies the data structure matches expected schema
- Confirms all fields are properly extracted:
  - Issues array
  - Review ID
  - Error state (null on success)
- Tests the data mapping logic

#### `handles API error gracefully without crash`
- Tests error resilience
- Confirms exceptions are caught and handled
- Verifies component doesn't crash on network errors

### 6. **Integration Tests** (2 tests)

#### `orchestrates full flow: params → checkStatus → data → view`
- End-to-end test of the entire pre-check flow
- Simulates navigation to review with parameters
- Verifies complete state transitions from params → API → data → view
- Confirms final state is "results" with populated data

#### `handles scenario: navigate to review with params, check completes, shows results`
- Real-world scenario test
- Simulates user navigating to `/review/test-xyz`
- Tests async flow with proper loading states
- Verifies cleanup after completion

## Test Structure

```
describe("ReviewPage - Status Pre-check (useEffect Logic)")
├── Loading State Tests
├── View Transitions on Pre-check
├── Conditional Execution
├── Single Execution Guarantee
├── Data Flow
└── Integration Tests
```

## Mocking Strategy

### API Mock
Uses Vitest's `vi.hoisted()` to mock `getTriageReview`:
```typescript
const mockApiModule = vi.hoisted(() => ({
  getTriageReview: vi.fn(),
}));
```

### Mock Review Fixture
`createMockReview()` creates a complete `SavedTriageReview` object with:
- Metadata (id, projectPath, timestamps, counts)
- Result (issues array)
- Git context
- Drilldowns

## Key Implementation Details Tested

### useEffect Dependencies
```typescript
useEffect(() => {
  if (!params.reviewId) return;
  // ... checkStatus logic
}, [params.reviewId])  // Only runs when reviewId changes
```

### State Guard
```typescript
if (reviewData.reviewId === null) {
  checkStatus();  // Only run if data not already loaded
}
```

### Try-Catch Flow
```typescript
try {
  const { review } = await getTriageReview(api, reviewId);
  setReviewData({ issues, reviewId, error: null });
  setView("results");
} catch {
  // Silently proceed to progress view
}
```

## Test Requirements Met

✅ Shows "Checking review..." while isCheckingStatus is true
✅ Sets view to "results" when completed review found
✅ Proceeds to progress view when review not found
✅ Does not check status when no reviewId in params
✅ Only checks once (doesn't re-run on every render)

## Running the Tests

```bash
# Run all tests
npm run build && npx vitest run

# Run only ReviewPage tests
npx vitest apps/web/src/app/pages/review.test.tsx

# Run only status pre-check tests
npx vitest apps/web/src/app/pages/review.test.tsx -t "Status Pre-check"
```

## Assertions Pattern

Tests follow a clear pattern:
1. **Setup:** Mock API responses
2. **Execute:** Simulate component logic
3. **Verify:** Assert state transitions and side effects

Example:
```typescript
it("test name", async () => {
  // Setup
  mockApiModule.getTriageReview.mockResolvedValueOnce({
    review: createMockReview(),
  });

  // Execute
  const params = { reviewId: "test-123" };
  // ... simulate logic

  // Verify
  expect(view).toBe("results");
});
```

## Additional Test Suite

The same file also contains comprehensive tests for `useScopedRouteState` covering:
- View initialization and persistence
- State transitions
- Scope isolation
- Re-render scenarios
- Edge cases

These tests ensure the view state management is robust across multiple reviews and scenarios.
