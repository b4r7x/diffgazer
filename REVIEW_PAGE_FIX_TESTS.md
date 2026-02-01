# Review Page Fix - Test Guide

## Quick Test Commands

```bash
# Run all review page tests
npx vitest run apps/web/src/app/pages/review.test.tsx

# Run with verbose output
npx vitest run apps/web/src/app/pages/review.test.tsx --reporter=verbose

# Run specific suite
npx vitest run apps/web/src/app/pages/review.test.tsx -t "Invalid UUID Navigation"

# Watch mode for development
npx vitest apps/web/src/app/pages/review.test.tsx
```

## Test Results

✅ **61 tests passing** (20 new + 41 existing)

## What's Tested

### Critical Fix Scenarios

1. **Invalid UUID Navigation** (4 tests)
   - Single status check only
   - Error toast on 404
   - Error toast on 400
   - No duplicate API calls

2. **Completed Review Navigation** (3 tests)
   - Status check → getTriageReview sequence
   - Direct navigation to results view
   - Skips getTriageReview when not saved

3. **Active Session Navigation** (2 tests)
   - No getTriageReview call when active
   - ReviewContainer mounts correctly

4. **React Strict Mode** (3 tests)
   - AbortController cancels first request
   - No state updates after abort
   - Single toast on double mount ⭐

5. **Resume Failure** (2 tests)
   - No redundant status check
   - Graceful error handling

6. **statusCheckDone Flag** (4 tests)
   - Prevents effect re-runs
   - Set after all paths
   - Works with errors

7. **Integration Flows** (3 tests)
   - Invalid → error → redirect
   - Completed → fetch → results
   - Active → mount container

## Key Test Patterns

```typescript
// Mock API client
const mockApi = {
  get: vi.fn(),
  post: vi.fn(),
  delete: vi.fn(),
  stream: vi.fn(),
};

// Factory for status response
const createMockReviewStatus = (overrides) => ({
  sessionActive: false,
  reviewSaved: false,
  isComplete: false,
  ...overrides,
});

// AbortController simulation
const controller = new AbortController();
const promise = checkStatus(controller.signal);
controller.abort(); // Cancel
await promise.catch(() => {}); // Handle
```

## Test File

`/Users/voitz/Projects/stargazer/apps/web/src/app/pages/review.test.tsx`

## Implementation Under Test

`/Users/voitz/Projects/stargazer/apps/web/src/app/pages/review.tsx:257-305`

Key changes tested:
- `getReviewStatus()` called first
- `getTriageReview()` only if `reviewSaved: true`
- `AbortController` for React Strict Mode
- `statusCheckDone` flag prevents re-runs
- `handleResumeFailed` doesn't re-check status
