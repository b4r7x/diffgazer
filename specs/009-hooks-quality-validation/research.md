# Research: Shared API Hooks Quality Validation

**Date**: 2026-03-25
**Method**: 5 parallel Opus agents performing independent deep audits

## Agent Results Summary

### Agent 1: matchQueryState Pattern Validation

**Decision**: matchQueryState is a valid React pattern with one correctness bug.
**Rationale**: Pure function called during render — no hook rules violations, no unnecessary re-renders, React 19 Compiler compatible. The guard clause pattern (`success: () => null` + early return) is idiomatic.
**Bug found**: Check order is error-first instead of data-first. During a `RefetchErrorResult` (background refetch failure with valid cached data), the function hides stale data and shows an error screen. Fix: swap data check before error check.
**Alternatives considered**: None needed — the pattern itself is correct, only the check order is wrong.

### Agent 2: Anti-Slop & Code Quality Audit

**Decision**: Code quality score 8.5/10. Zero critical issues. Two warnings (dead code), four info items.
**Rationale**: Clean separation of concerns, consistent patterns, minimal abstraction, no AI slop, no unnecessary comments, no type workarounds. The mutation pattern repetition (useApi + useQueryClient + useMutation) is structural, not extractable.
**Dead code found**: `queries/git.ts` (orphaned file), `trustQueries.single`/`list` (unused factories), `batchEvents` option (unused YAGNI).
**Alternatives considered**: Evaluated a `createMutationHook` helper to reduce mutation boilerplate — rejected because each mutation has different args and invalidation logic, making a generic helper lose readability (KISS violation).

### Agent 3: Loading State Library Research

**Decision**: Keep matchQueryState. No additional libraries needed.
**Rationale**: Dual-platform (web + Ink) constraint makes Suspense non-viable (Ink requires concurrent mode, not enabled). ts-pattern adds dependency for marginal benefit. React 19 `use()` has no caching/retry. Community consensus is custom 20-line helpers over library dependencies.
**Alternatives considered**:

| Alternative | Verdict | Reason |
|-------------|---------|--------|
| `useSuspenseQuery` | Not viable | Ink concurrent mode not enabled; pushes state to tree boundaries |
| `ts-pattern` | Overkill | Adds dependency for a simple 3-branch discriminated union |
| `@suspensive/react-query` | Redundant | Hooks already in TanStack Query v5 natively |
| React 19 `use()` | Not a replacement | No caching, deduplication, retry, or invalidation |
| `skipToken` | Worth adopting | Better type safety than `enabled: false` — orthogonal to matchQueryState |

**Key recommendation**: Fix matchQueryState check order to data-first (per TkDodo's "Status Checks in React Query" blog post).

### Agent 4: React 19 Patterns Validation

**Decision**: All hooks are React 19 Compiler compatible and follow canonical TanStack Query v5 patterns.
**Rationale**: Zero `useCallback`/`useMemo` (correct per project convention). Context value is stable (module-level singleton). Query key hierarchy is correct. `networkMode: 'always'` properly configured for CLI. Streaming hook uses `useReducer` correctly with proper abort controller cleanup.
**Minor findings**: `serverQueries.health` returns `void` (incompatible with matchQueryState if anyone tried to use it). `useDeleteReview` manually constructs query key instead of using factory.
**Alternatives considered**: None — current patterns are canonical.

### Agent 5: Consumer Integration Audit

**Decision**: All 24 shared hooks are used correctly across both apps. No remaining hand-rolled fetch patterns.
**Rationale**: Provider setup correct in both apps (proper nesting, platform-appropriate config). 4 direct API calls exist but all are justified (Router guards, imperative flows). No unused hook imports. Review lifecycle hooks are intentionally platform-specific.
**matchQueryState adoption**: Used in 2 places (history screens). Other screens use manual patterns for multi-query scenarios — acceptable since matchQueryState operates on a single `UseQueryResult`.
**Alternatives considered**: None needed — hook consumption is clean.

## Consolidated Findings

### Actionable (fix in this spec)

| # | Priority | Issue | File | Fix |
|---|----------|-------|------|-----|
| 1 | Medium | Check order hides stale data during refetch failures | `match-query-state.ts` | Swap to data-first |
| 2 | Low | Orphaned query factory file | `queries/git.ts` | Delete |
| 3 | Low | Unused query factories | `queries/trust.ts` | Remove `single()`/`list()` |
| 4 | Low | Unused `batchEvents` option (YAGNI) | `use-review-stream.ts` | Remove option |
| 5 | Low | Unused `empty` handler | `match-query-state.ts` | Remove from interface |

### Non-actionable (correct behavior, documented)

| # | Observation | File | Why no action |
|---|-------------|------|---------------|
| 1 | `serverQueries.health` returns `void` | `queries/server.ts` | Not used with matchQueryState; health check doesn't need data |
| 2 | `useDeleteReview` constructs key manually | `review.ts:32` | Functionally identical to using factory |
| 3 | Section comments ("// Query hooks") | `config.ts` | Harmless, aid scannability |
| 4 | Barrel comment couples to specific consumer | `index.ts` | Minor, not worth a standalone change |
| 5 | CLI review-lifecycle not shared with web | Both apps | Intentional — different phase models and navigation |

## Sources

- TkDodo: "Status Checks in React Query" (data-first recommendation)
- TanStack Query v5 official docs: useSuspenseQuery, skipToken, queryOptions
- Ink GitHub Issue #688: React 19 Support (concurrent mode requirement)
- Community: Gabriel Pichot blog on matchQueryStatus pattern
- @suspensive/react-query: Toss team's Suspense wrappers (now deprecated for v5)
