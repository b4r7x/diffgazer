# Quickstart: Hooks Quality Validation

## Pre-Implementation Checklist

- [ ] Read `research.md` — consolidated findings from 5 audit agents
- [ ] Read `data-model.md` — interface changes for matchQueryState and trustQueries
- [ ] Verify you're on branch `009-hooks-quality-validation`

## Changes Overview

### 1. Fix matchQueryState (match-query-state.ts)

Swap check order to data-first. Remove `empty` handler.

```typescript
// Before
if (query.isLoading) return handlers.loading();
if (query.error) return handlers.error(query.error);
if (query.data !== undefined) {
  if (handlers.empty?.(query.data)) return handlers.loading();
  return handlers.success(query.data);
}
return handlers.loading();

// After
if (query.isLoading) return handlers.loading();
if (query.data !== undefined) return handlers.success(query.data);
if (query.error) return handlers.error(query.error);
return handlers.loading();
```

### 2. Delete queries/git.ts

Entire file. No imports to update (not referenced anywhere).

### 3. Simplify queries/trust.ts

Remove `single()` and `list()` — only `all()` is used.

### 4. Remove batchEvents from use-review-stream.ts

Remove `UseReviewStreamOptions` interface and `options` parameter. Simplify `dispatchEvent`.

## Verification

```bash
pnpm run type-check
pnpm build
# Verify no import errors in either app
```

## Consumer Impact

Zero. No public API changes — `index.ts` barrel exports are unchanged. The `empty` handler was optional and unused. `batchEvents` was optional and unused. `queries/git.ts` was not exported.
