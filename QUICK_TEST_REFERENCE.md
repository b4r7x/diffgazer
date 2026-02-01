# F5 Restoration Test - Quick Reference

## What This Test Does

Validates the complete F5 (refresh) restoration flow for the Stargazer review feature. Tests how the app behaves when users refresh or navigate back to a review URL, covering three key scenarios.

## Three Key Scenarios

### Scenario 1: Completed Review (Normal Completion)
```
1. User starts new review → sees progress view
2. Review completes, shows summary
3. User navigates to results view
4. User presses F5
5. Results load immediately (no progress view shown)
```

**Key Behavior:** getTriageReview succeeds, skips ReviewContainer entirely

### Scenario 2: In-Progress Review (Interrupted Stream)
```
1. User starts review, watches for 15 seconds
2. Network issue or browser crash
3. User presses F5 mid-stream
4. Review resumes from server state
5. Progress view shows with correct elapsed time
```

**Key Behavior:** resume() called instead of start(), timer shows correct time

### Scenario 3: Stored Complete Review (Late Return)
```
1. User completed review hours/days ago
2. Returns to browser tab with /review/{id}
3. Data exists in server/storage
4. F5 refresh happens
5. Results load instantly, no progress
```

**Key Behavior:** Same as Scenario 1, but review already in storage

## What Gets Tested

| Component | What We Validate |
|-----------|-------------------|
| **ReviewPage** | Status check logic, view state, error handling |
| **ReviewContainer** | Resume vs start decision, callback behavior |
| **useTriageStream** | Session restoration, event batching, timer |
| **Router** | URL updates, param-driven behavior |

## Test Anatomy

```typescript
describe("F5 Restoration Flow Integration")
  ├── ReviewPage Status Check Logic (3 tests)
  ├── ReviewContainer Resume Logic (4 tests)
  ├── useTriageStream Session Restoration (4 tests)
  ├── View State Persistence (2 tests)
  ├── Complete Restoration Flows (3 scenarios)
  ├── Error Handling (2 tests)
  └── Performance Considerations (2 tests)

Total: 19 tests, all passing
```

## Running

```bash
# Run this specific test file
npx vitest run apps/web/src/features/review/review-f5-restoration.test.tsx

# Watch mode
npx vitest apps/web/src/features/review/review-f5-restoration.test.tsx

# All tests
npm run test
```

## Key Code Paths Verified

### ReviewPage + ReviewContainer Interaction
```
ReviewPage receives reviewId in params
  ↓
useEffect checks if review is completed
  ↓
If found → set view="results" (skip progress)
If not → render ReviewContainer with reviewId
  ↓
ReviewContainer detects reviewId
  ↓
Calls resume(reviewId) instead of start()
  ↓
Shows progress view with resumed events
```

### useTriageStream Event Handling
```
resume(reviewId) called
  ↓
dispatch({ type: "START" })
dispatch({ type: "SET_REVIEW_ID", reviewId })
  ↓
API returns events
  ↓
review_started event → dispatch immediately
Other events → queue and batch with RAF
  ↓
State updated with issue data, step progress
```

### Timer Accuracy
```
Original startTime = Date.now() - 30000 (30s ago)
User F5 refresh
Resume captured server state with original startTime
UI shows elapsed = now - startTime (preserves timer)
```

## Files Involved

```
apps/web/
├── src/
│   ├── app/pages/review.tsx          (ReviewPage)
│   ├── features/review/
│   │   ├── components/
│   │   │   └── review-container.tsx   (ReviewContainer)
│   │   ├── hooks/
│   │   │   └── use-triage-stream.ts   (useTriageStream hook)
│   │   └── review-f5-restoration.test.tsx  ← NEW TEST FILE
│   └── lib/api.ts
├── vitest.config.ts                  (test config)
└── vitest.setup.ts                   (test setup)
```

## What Makes This Different from Unit Tests

- **Not** testing individual components in isolation
- **Is** testing the interaction flow between components
- **Focuses** on expected behavior sequences, not implementation
- **Documents** the complete user journeys with step-by-step flow
- **Validates** business logic at the flow level

## Quick Debug Checklist

If adding new F5 scenarios, verify:

- [ ] ReviewPage has the param in useParams hook
- [ ] ReviewPage useEffect runs after params change
- [ ] getTriageReview is called for completed reviews
- [ ] ReviewContainer renders when status check fails
- [ ] params.reviewId triggers resume() not start()
- [ ] resume() dispatches early SET_REVIEW_ID for URL stability
- [ ] Timer elapsed time calculated from original startTime
- [ ] Error handling doesn't crash app
- [ ] View state persists in route query
- [ ] Performance: progress view skipped for completed reviews

## Test Data

Two mock issues used throughout:
1. **SQL Injection** - security/blocker (critical)
2. **Unused Variable** - readability/nit (minor)

Both include all TriageIssue fields for realistic data validation.

## Expected Test Duration

- Full suite: ~2ms (very fast)
- Per test: <1ms average
- Setup/teardown: ~55ms

These are behavior tests, not rendering tests, so execution is instant.
