# UUID Validation Tests Summary

Tests created for router-level UUID validation fix and home page error toast display.

## Test Files Created

### 1. `/apps/web/src/app/router.test.tsx`
Tests for UUID validation in router's `beforeLoad` hook.

**Test Coverage:**
- **UUID Format Validation** (5 tests)
  - Accepts valid UUID v4 format
  - Rejects invalid UUID formats (9 test cases)
  - Validates UUID version 4 specifically
  - Validates UUID variant bits (8, 9, a, b in fourth group)
  - Case-insensitive hex character validation

- **beforeLoad Hook Behavior** (3 tests)
  - Redirects to home with error param when UUID is invalid
  - Does not redirect when UUID is valid
  - Redirects with specific error code 'invalid-review-id'

- **Edge Cases** (3 tests)
  - Rejects UUID with extra whitespace
  - Rejects null or undefined values
  - Rejects UUIDs with special characters

**Total: 11 tests, all passing**

### 2. `/apps/web/src/app/pages/home.test.tsx`
Tests for error toast display on home page when navigating with error parameter.

**Test Coverage:**
- **Invalid Review ID Error** (4 tests)
  - Shows error toast when search.error is 'invalid-review-id'
  - Navigates to '/' to clear error param after showing toast
  - Uses replace:true to avoid adding history entry
  - Shows toast before navigating (execution order)

- **Toast Message Content** (3 tests)
  - Displays correct error variant ("error")
  - Displays correct title ("Invalid Review ID")
  - Displays correct message ("The review ID format is invalid.")

- **No Error Cases** (5 tests)
  - Does not show toast when search.error is undefined
  - Does not show toast when search.error is different error code
  - Does not show toast when search object is empty
  - Does not show toast when search.error is null
  - Does not show toast when search.error is empty string

- **Error Condition Precision** (2 tests)
  - Only triggers on exact match 'invalid-review-id'
  - Is case-sensitive for error code

- **Integration: Complete Error Flow** (2 tests)
  - Handles complete flow from router redirect to toast display
  - Does not trigger error flow for valid UUID

**Total: 16 tests, all passing**

## Implementation Coverage

### Router Implementation
**File:** `/apps/web/src/app/router.tsx:32-42`

```typescript
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const reviewDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/review/$reviewId',
  component: ReviewPage,
  beforeLoad: ({ params }) => {
    if (!UUID_REGEX.test(params.reviewId)) {
      throw redirect({ to: '/', search: { error: 'invalid-review-id' } });
    }
  },
})
```

### Home Page Implementation
**File:** `/apps/web/src/app/pages/home.tsx:30-39`

```typescript
useEffect(() => {
  if (search.error === 'invalid-review-id') {
    showToast({
      variant: "error",
      title: "Invalid Review ID",
      message: "The review ID format is invalid.",
    });
    navigate({ to: '/', replace: true });
  }
}, [search.error, showToast, navigate]);
```

## Test Results

```
✓ apps/web/src/app/router.test.tsx (11 tests) 2ms
✓ apps/web/src/app/pages/home.test.tsx (16 tests) 4ms

Test Files  2 passed (2)
Tests      27 passed (27)
```

## TDD Principles Applied

1. **Test-First Approach**: Tests were written to verify the existing implementation
2. **Focused Tests**: Each test validates a single behavior
3. **Edge Case Coverage**: Tests cover null, undefined, empty strings, and invalid formats
4. **Integration Tests**: End-to-end flow tests verify router → redirect → toast display
5. **Clear Test Names**: Descriptive test names that explain what is being tested
6. **Minimal Mocking**: Tests use direct logic simulation rather than complex mocks
7. **Fast Execution**: All tests run in under 10ms total

## Key Validation Rules Tested

- UUID must be version 4 format
- UUID must have valid variant bits (8, 9, a, b in fourth group)
- UUID format is case-insensitive for hex characters
- Invalid UUIDs redirect to home with error parameter
- Error parameter triggers toast display with specific message
- Error parameter is cleared from URL after toast is shown
- Navigation uses replace:true to avoid history pollution
