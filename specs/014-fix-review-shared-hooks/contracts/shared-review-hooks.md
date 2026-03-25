# Contract: Shared Review Hooks (`@diffgazer/api/hooks`)

## useReviewStream.resume (modified)

### Before (013 branch)
```
resume(reviewId: string) -> Promise<void>
```
All errors handled internally via dispatch. Caller has no visibility.

### After (this feature)
```
resume(reviewId: string) -> Promise<Result<void, StreamReviewError>>
```
- `SESSION_STALE` / `SESSION_NOT_FOUND`: Returns error Result, does NOT dispatch RESET or ERROR. Caller decides.
- Other errors: Dispatches ERROR internally AND returns error Result.
- Success: Dispatches SET_REVIEW_ID + streams events + dispatches COMPLETE. Returns `ok(undefined)`.

---

## useReviewStart (new export)

```
useReviewStart(options: UseReviewStartOptions) -> UseReviewStartResult
```

### Input Contract
| Field            | Type                                    | Required | Description                                      |
| ---------------- | --------------------------------------- | -------- | ------------------------------------------------ |
| mode             | ReviewMode                              | Yes      | "staged" / "unstaged" / "files"                  |
| configLoading    | boolean                                 | Yes      | Config query loading state                       |
| settingsLoading  | boolean                                 | Yes      | Settings query loading state                     |
| isConfigured     | boolean                                 | Yes      | Whether app is fully configured                  |
| defaultLenses    | LensId[]                                | Yes      | Resolved lenses from settings                    |
| reviewId         | string / undefined                      | No       | URL-based review ID for direct resume            |
| start            | (opts) => Promise<void>                 | Yes      | Stream start function from useReviewStream       |
| resume           | (id) => Promise<Result<void, Error>>    | Yes      | Stream resume function from useReviewStream      |
| getActiveSession | (mode) => Promise<{ session / null }>   | Yes      | Active session query from useActiveReviewSession |

### Output Contract
| Field        | Type         | Description                                    |
| ------------ | ------------ | ---------------------------------------------- |
| startReview  | () => void   | Imperative trigger (call from mount or restart) |
| hasStarted   | boolean      | Whether start flow initiated (reactive state)  |
| hasStreamed   | boolean      | Whether streaming began (reactive state)       |

### Behavior
1. When `startReview()` is called:
   - Guards: if `configLoading || settingsLoading || !isConfigured`, returns (no-op)
   - If `reviewId` provided: calls `resume(reviewId)`, handles Result:
     - `SESSION_STALE`: calls `start({ mode, lenses })` (fresh start)
     - `SESSION_NOT_FOUND`: returns error (lifecycle decides how to handle)
     - Success: streaming begins
   - If no `reviewId`: calls `getActiveSession(mode)`:
     - Session found: calls `resume(session.reviewId)` with same error handling
     - No session: calls `start({ mode, lenses })` (fresh start)
2. Sets `hasStarted = true` when start flow begins
3. Sets `hasStreamed = true` when streaming is initiated

---

## useReviewCompletion (new export)

```
useReviewCompletion(options: UseReviewCompletionOptions) -> UseReviewCompletionResult
```

### Input Contract
| Field       | Type          | Required | Description                              |
| ----------- | ------------- | -------- | ---------------------------------------- |
| isStreaming  | boolean       | Yes      | From useReviewStream state               |
| error       | string / null | Yes      | From useReviewStream state               |
| hasStreamed  | boolean       | Yes      | From useReviewStart result               |
| steps       | StepState[]   | Yes      | From useReviewStream state               |
| onComplete  | () => void    | Yes      | Callback when completion delay finishes  |

### Output Contract
| Field        | Type       | Description                                |
| ------------ | ---------- | ------------------------------------------ |
| isCompleting | boolean    | True during completion delay window        |
| skipDelay    | () => void | Cancel timer, call onComplete immediately  |
| reset        | () => void | Clear timer and internal state for re-runs |

### Behavior
1. Detects `isStreaming` transition from `true` to `false`
2. When detected AND `hasStreamed === true` AND `error === null`:
   - Sets `isCompleting = true`
   - Computes delay: 2300ms if report step completed, 400ms otherwise
   - After delay: sets `isCompleting = false`, calls `onComplete()`
3. `skipDelay()`: clears timer, sets `isCompleting = false`, calls `onComplete()`
4. `reset()`: clears timer, resets `isCompleting = false`

### Constants
- `REPORT_COMPLETE_DELAY_MS = 2300`
- `DEFAULT_COMPLETE_DELAY_MS = 400`

---

## Shared Pure Functions (new exports from `@diffgazer/core/review`)

```
isNoDiffError(error: string | null) -> boolean
isCheckingForChanges(isStreaming: boolean, steps: StepState[]) -> boolean
getLoadingMessage(opts: { configLoading, settingsLoading, isCheckingForChanges, isInitializing }) -> string | null
```

These are stateless derived computations. No side effects, no hooks.
