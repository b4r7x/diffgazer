# Data Model: matchQueryState Interface Changes

**Date**: 2026-03-25

## matchQueryState — Before

```typescript
interface QueryStateHandlers<T> {
  loading: () => ReactNode;
  error: (err: Error) => ReactNode;
  empty?: (data: T) => boolean;    // ← removed (unused, wrong fallback)
  success: (data: T) => ReactNode;
}

function matchQueryState<T>(
  query: UseQueryResult<T>,
  handlers: QueryStateHandlers<T>,
): ReactNode;
```

Check order: `isLoading` → `error` → `data` → fallback `loading`

## matchQueryState — After

```typescript
interface QueryStateHandlers<T> {
  loading: () => ReactNode;
  error: (err: Error) => ReactNode;
  success: (data: T) => ReactNode;
}

function matchQueryState<T>(
  query: UseQueryResult<T>,
  handlers: QueryStateHandlers<T>,
): ReactNode;
```

Check order: `isLoading` → `data` → `error` → fallback `loading`

## Changes Summary

| Change | Reason |
|--------|--------|
| `empty` handler removed | Unused by all consumers. Fallback to `loading()` was semantically wrong (empty data is not a loading state). |
| Check order swapped (data before error) | TkDodo's recommendation. Prevents `RefetchErrorResult` from hiding valid stale data. |

## trustQueries — Before

```typescript
export const trustQueries = {
  all: () => ["trust"] as const,
  single: (api, projectId) => queryOptions({ ... }),   // ← removed
  list: (api) => queryOptions({ ... }),                 // ← removed
};
```

## trustQueries — After

```typescript
export const trustQueries = {
  all: () => ["trust"] as const,
};
```

## UseReviewStreamOptions — Before

```typescript
export interface UseReviewStreamOptions {
  batchEvents?: (dispatch: Dispatch<StreamAction>, events: ReviewEvent[]) => void;
}
```

## UseReviewStreamOptions — After

Interface removed entirely (no remaining options). `useReviewStream` takes no arguments.

## Deleted Files

| File | Reason |
|------|--------|
| `queries/git.ts` | Orphaned — hooks that consumed it were removed in 008 |
