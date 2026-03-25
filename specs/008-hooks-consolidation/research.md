# Research: Shared API Hooks Consolidation

**Feature**: 008-hooks-consolidation
**Date**: 2026-03-25

## Decision 1: Query Factory File Naming

**Decision**: Rename `*.queries.ts` → `*.ts` inside `queries/` directory.

**Rationale**: The `.queries` suffix is redundant when files already live in a `queries/` directory. `queries/config.queries.ts` reads as "queries/config queries" — a stutter. TanStack Query ecosystem has no prescribed naming convention; what matters is the `queryOptions()` factory pattern inside the files. Community examples (TkDodo, official docs) use plain names.

**Alternatives considered**:
- Keep `.queries.ts` suffix: Adds redundant context, rejected for stuttering
- Move factories inline into hook files: Loses the separation between configuration and React hook logic, rejected

## Decision 2: File-Per-Hook vs Domain Consolidation

**Decision**: Consolidate from 25+ single-hook files to ~8 domain-grouped files.

**Rationale**: TkDodo (TanStack Query maintainer) recommends vertical slicing by domain over horizontal slicing by type. The current 10 pure thin query wrappers (3 lines each: `useApi()` + `useQuery(factory(api))`) don't justify individual files. Grouping by domain (config, review, trust, git, server) keeps related queries and mutations together, reduces file count by ~65%, and makes the codebase navigable.

**Alternatives considered**:
- Keep 1-file-per-hook: Works but creates 25+ files for mostly 3-line functions. Rejected for excessive fragmentation.
- Eliminate thin wrapper hooks entirely (consumers call `useQuery(factory(api))` directly): TkDodo now recommends this approach, but the `useApi()` context injection saves consumers one repeated line per call site. Hooks also provide a stable import surface. Rejected for now; could revisit later.
- Use `react-query-kit` to generate hooks: ~23k weekly downloads, but `queryOptions()` already provides the same functionality natively. Adding a dependency for marginal benefit. Rejected.

**Sources**:
- [TkDodo: Creating Query Abstractions](https://tkdodo.eu/blog/creating-query-abstractions)
- [TkDodo: The Query Options API](https://tkdodo.eu/blog/the-query-options-api)
- [TanStack Query Discussion #3017](https://github.com/TanStack/query/discussions/3017)

## Decision 3: Unused Hook Disposition

**Decision**: Remove all 6 unused hooks from the shared package. Keep all backend endpoints intact.

**Rationale**: All 6 hooks were created speculatively during `006-shared-api-hooks` (one per `BoundApi` method). Investigation confirmed:

| Hook | Backend | Why unused |
|------|---------|-----------|
| `useTrust` | Endpoint exists | Current project trust comes from `useInit()` via `/api/config/init` |
| `useTrustedProjects` | Endpoint exists | No multi-project trust UI exists |
| `useGitStatus` | Endpoint exists | Git ops happen server-side during review stream |
| `useGitDiff` | Endpoint exists | No pre-review diff preview UI exists |
| `useRunDrilldown` | Fully implemented + tested | Backend drilldown feature complete, no UI trigger built |
| `useDeleteConfig` | Endpoint exists | No "reset all config" UI exists |

Backend endpoints are preserved for future feature development (confirmed in spec clarification).

**Alternatives considered**:
- Connect `useRunDrilldown` to UI now: Would expand scope beyond consolidation. Rejected per clarification.
- Remove backend endpoints too: Unnecessary churn, endpoints may be needed later. Rejected per clarification.
- Keep hooks but mark as `@deprecated`: Still clutters the API surface. Rejected.

## Decision 4: Loading State Helper Approach

**Decision**: Create a `matchQueryState()` utility function (pattern-matching style).

**Rationale**: Research evaluated three approaches:

1. **`useSuspenseQuery` + `AsyncBoundary`**: TanStack Query v5 built-in. Eliminates `isLoading`/`error` checks via Suspense boundaries. Works in Ink 6 (React Suspense is supported), but requires restructuring components and doesn't work with `enabled` option. High migration cost for existing screens.

2. **`@suspensive/react-query`**: ~3.9k downloads, provides `<SuspenseQuery>` JSX wrapper. Thin wrapper over TanStack Query v5's built-in Suspense. Not worth adding a dependency.

3. **`matchQueryState()` utility** (chosen): A pure function that maps `UseQueryResult<T>` to render callbacks (`loading`, `error`, `empty`, `success`). Works everywhere (React DOM, Ink, any renderer). No Suspense or ErrorBoundary restructuring needed. Zero dependencies. Incremental adoption — screens can migrate one at a time without changing architecture.

```typescript
function matchQueryState<T>(
  query: UseQueryResult<T>,
  handlers: {
    loading: () => ReactNode;
    error: (err: Error) => ReactNode;
    empty?: (data: T) => boolean;
    success: (data: T) => ReactNode;
  }
): ReactNode
```

**Alternatives considered**:
- Full Suspense migration: Too high cost for a consolidation task. Deferred to future work.
- `@suspensive/react-query`: Unnecessary dependency. Rejected.
- `react-query-kit`: Overlaps with existing `queryOptions()` pattern. Rejected.
- No helper (keep manual checks): Works but verbose and inconsistent. Rejected.

**Sources**:
- [TanStack Query: Suspense guide](https://tanstack.com/query/latest/docs/react/guides/suspense)
- [Pattern Matching for TanStack Query](https://gabrielpichot.fr/blog/simplify-tanstack-react-query-state-handling-with-pattern-matching/)
- [@suspensive/react-query npm](https://www.npmjs.com/package/@suspensive/react-query)

## Decision 5: Cross-Platform Hook Sharing

**Decision**: No changes needed. Current architecture is correct.

**Rationale**: The existing pattern of shared hooks in `@diffgazer/api/hooks` consumed by both React DOM (web) and Ink (CLI) with platform-specific `QueryClient` configs is the reference implementation for this use case. No libraries or documented community patterns exist for this — the project has effectively pioneered this approach.

Key elements that make it work:
- `networkMode: 'always'` bypasses `navigator.onLine` in Node.js
- `refetchOnWindowFocus: false` / `refetchOnReconnect: false` for CLI
- Platform-specific `QueryClient` configs (different `staleTime`, `retry`)
- Context-based API injection (`ApiProvider`) for platform-agnostic hook logic

**Sources**:
- [TanStack Query: Network Mode](https://tanstack.com/query/v5/docs/react/guides/network-mode)

## Decision 6: Query Factory Re-export Cleanup

**Decision**: Remove `reviewQueries`, `serverQueries`, `trustQueries`, `gitQueries` from public barrel. Keep `configQueries`.

**Rationale**: Only `configQueries` is used externally (by web app's `ConfigProvider` at `apps/web/src/app/providers/config-provider.tsx`). The other 4 factories are only used internally by hook files. Internal imports reference the factory files directly, not through the barrel.

## Thin Wrapper Audit Summary

**10 pure thin query wrappers** (save consumers 1 line of `const api = useApi()`):
`useSettings`, `useInit`, `useConfigCheck`, `useProviderStatus`, `useReviews`, `useActiveReviewSession`, `useReviewContext`, `useTrustedProjects` (removed), `useGitStatus` (removed), `useGitDiff` (removed)

**3 near-thin wrappers** (add `enabled` guard or option spreading):
`useOpenRouterModels`, `useReview`, `useTrust` (removed)

**11 mutation hooks** (encode cache invalidation map — genuine value):
All mutation hooks are kept because they document which queries to invalidate on success. This is non-trivial logic that consumers should not need to know.

**2 hooks with substantial logic**:
- `useServerStatus`: Derives `ServerState` discriminated union from query state
- `useReviewStream`: 160 lines, `useReducer`, abort controller management, full streaming lifecycle
