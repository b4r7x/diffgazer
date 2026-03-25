# Quickstart: Shared API Hooks Consolidation

**Feature**: 008-hooks-consolidation

## What Changes

The `@diffgazer/api/hooks` package is reorganized:
- 25+ single-hook files → 8 domain-grouped files
- 6 unused hooks removed
- Query factory files renamed (drop `.queries` suffix)
- New `matchQueryState()` utility added

## Consumer Impact

**Zero.** All used hook imports from `@diffgazer/api/hooks` continue to work unchanged. The barrel export (`index.ts`) preserves every hook name and type signature. Only internal file structure changes.

## Key Files

| File | Purpose |
|------|---------|
| `packages/api/src/hooks/config.ts` | All config queries + mutations (9 hooks) |
| `packages/api/src/hooks/review.ts` | All review queries + mutations (6 hooks) |
| `packages/api/src/hooks/trust.ts` | Trust mutations (2 hooks) |
| `packages/api/src/hooks/server.ts` | Server status + shutdown (2 hooks) |
| `packages/api/src/hooks/use-review-stream.ts` | Streaming hook (unchanged) |
| `packages/api/src/hooks/match-query-state.ts` | Loading state utility |
| `packages/api/src/hooks/context.ts` | ApiProvider + useApi (unchanged) |
| `packages/api/src/hooks/index.ts` | Barrel re-exports |

## matchQueryState Usage

```typescript
import { useSettings, matchQueryState } from "@diffgazer/api/hooks";

function SettingsScreen() {
  const query = useSettings();

  return matchQueryState(query, {
    loading: () => <Spinner label="Loading settings..." />,
    error: (err) => <Text color="red">Error: {err.message}</Text>,
    success: (data) => <SettingsForm settings={data} />,
  });
}
```

## Build & Verify

```bash
# Build the hooks package
pnpm --filter @diffgazer/api build

# Build both consumer apps
pnpm build

# Run tests
pnpm test
```

## Implementation Order

1. Rename query factory files (`.queries.ts` → `.ts`)
2. Delete unused hooks + re-exports
3. Consolidate remaining hooks by domain
4. Add `matchQueryState()` utility
5. Verify builds + tests
