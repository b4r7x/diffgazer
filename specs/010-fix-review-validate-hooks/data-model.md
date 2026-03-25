# Data Model: Fix Web Review Regression & Hooks Quality

**Date**: 2026-03-25

## useReviewStream.resume — Return Type Change

### Before (broken)

```typescript
const resume = async (reviewId: string): Promise<void>
```

Resume dispatches actions internally but does not surface the result to the caller. Stale/not-found sessions cause a RESET that nobody handles.

### After (fixed)

```typescript
const resume = async (reviewId: string): Promise<Result<void, StreamReviewError>>
```

Resume still dispatches START/RESET/ERROR/COMPLETE internally for the state machine. But it also returns the Result so the caller can decide what to do on failure (e.g., call startFresh).

**Backward compatible**: Callers using `void resume(id)` still compile (void discards the return value).

## useReviewStart — Resume Error Handling Restored

### Before (broken)

```typescript
// Fire-and-forget, no error handling
void resume(reviewId);
```

### After (fixed)

```typescript
const result = await resume(reviewId);
if (!result.ok && (
  result.error.code === ReviewErrorCode.SESSION_STALE ||
  result.error.code === ReviewErrorCode.SESSION_NOT_FOUND
)) {
  startFresh();
}
```

## useReviewCompletion — Guard Against False Trigger

### Before (broken)

```typescript
if (wasStreaming && !isStreaming && hasStreamed && !error) {
  // fires on START→RESET transition (false positive)
}
```

### After (fixed)

```typescript
if (wasStreaming && !isStreaming && hasStreamed && !error && reviewIdRef.current !== null) {
  // only fires when a real review has completed (reviewId set by review_started event)
}
```

## CLI useReviewLifecycle — Same Two Fixes

### Resume handling

```typescript
// Before: void stream.resume(activeReviewId);
// After:
const result = await stream.resume(activeReviewId);
if (!result.ok) {
  startFresh();
}
```

### Completion guard

```typescript
// Before: wasStreaming && !isStreaming && hasStreamedRef.current && !stream.state.error
// After: add && stream.state.reviewId !== null
```

## useDeleteReview — Query Key Fix

### Before

```typescript
qc.removeQueries({ queryKey: [...reviewQueries.all(), id] });
```

### After

```typescript
qc.removeQueries({ queryKey: reviewQueries.detail(api, id).queryKey });
```

## Exports Change

```typescript
// packages/api/src/hooks/index.ts — add type re-export
export type { StreamReviewError } from "../review.js";
```

## matchQueryState — No Changes

Interface and implementation remain as-is (already correct after spec 009 fixes).
