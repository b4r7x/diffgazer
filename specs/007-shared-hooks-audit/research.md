# Research: Shared API Hooks Quality Audit

**Date**: 2026-03-25
**Method**: 6 parallel Opus agents + detailed file-level audit

## Decision 1: No Additional Data Fetching Library Needed

**Decision**: Keep TanStack Query v5 with existing `queryOptions()` factory pattern. Do not add any companion libraries.

**Rationale**: The current pattern is canonical for TanStack Query v5, confirmed by the library maintainer (TkDodo) in official docs and blog posts. The `queryOptions()` helper co-locates query key, fetch function, and configuration with full type inference — this is the recommended first building block in v5, replacing the need for external key factory libraries.

**Alternatives considered**:

| Library | Why rejected |
| ------- | ------------ |
| `@lukemorales/query-key-factory` v1.3.4 | Superseded by built-in `queryOptions()`. Last release ~2 years ago. Was designed for v3/v4 before `queryOptions()` existed. |
| `react-query-kit` v3.3.2 | Provides `createQuery()`/`createMutation()` factories but conflicts with the `useApi()` context injection pattern. Would require restructuring API injection. |
| `@suspensive/react-query` v3.10.1 | TQ v5 already has built-in `useSuspenseQuery`. Only adds value if adopting Suspense-first architecture with boundary components. Current UI pattern uses conditional `isLoading` checks. |
| tRPC v11 | Would eliminate the entire API + hooks layer with end-to-end type safety. However, requires rewriting the Hono server as tRPC procedures — a major architectural change not justified by the current boilerplate level (~150 lines). |
| `@hey-api/openapi-ts` / Orval / Kubb | Would auto-generate API client + hooks from OpenAPI spec. Diffgazer has no OpenAPI spec, so this requires creating and maintaining one first. |
| React 19 `use()` hook | Only handles promise unwrapping. No caching, deduplication, retry, stale-while-revalidate, or cache invalidation. Not a replacement for TanStack Query. |

## Decision 2: `networkMode: 'always'` Remains Correct for Ink

**Decision**: Keep `networkMode: 'always'` with `refetchOnWindowFocus: false` and `refetchOnReconnect: false` for the CLI QueryClient.

**Rationale**: Official TanStack Query docs state this mode "will always fetch and ignore the online/offline state" — the correct behavior for non-browser environments. The newer `environmentManager` API (PR #10199) handles SSR hydration detection, not runtime client behavior in non-browser renderers.

**Alternatives considered**: None. This is the only documented approach for Node.js environments with TanStack Query.

## Decision 3: Thin Wrapper Hooks Are Acceptable

**Decision**: Keep the one-hook-per-file pattern for query and mutation hooks. Do not consolidate into a factory generator.

**Rationale**: TkDodo notes that thin wrapper hooks which only call `useQuery(factoryOptions(api))` are "borderline" — the `queryOptions()` factory itself is the intended abstraction. However, in diffgazer's case the hooks abstract away the `useApi()` context call, making the consumer API cleaner (`useSettings()` vs `useQuery(configQueries.settings(api))`). This is justified for a cross-platform project sharing hooks between two apps. The total overhead is ~150 lines across 25 hook files.

**Alternatives considered**:
- Factory generator function: `createQueryHook(configQueries.settings)` → reduces to one-liners but adds indirection for minimal savings
- Direct `queryOptions()` usage in components: saves no lines (still need `useApi()` + `useQuery()`) and scatters API context access

## Decision 4: Consolidate `useServerStatus` to Shared Package

**Decision**: Move the server status mapping logic (query result → `ServerState` discriminated union) into the shared `useServerStatus` hook in `@diffgazer/api/hooks`.

**Rationale**: The wrapper is functionally identical in both apps. The only difference is the web version declares a named `ServerStatus` interface while the CLI inlines the type. Both map `isLoading → checking`, `isSuccess → connected`, `error → error` and provide a `retry` function. A third reimplementation exists in the CLI diagnostics screen. Consolidating eliminates 3 implementations → 1.

**Alternatives considered**:
- Keep as platform wrappers: rejected because there is zero platform-specific logic in either wrapper
- Create a shared mapping utility (not a hook): rejected because the mapping is tightly coupled to the query hook's return shape

## Decision 5: Place `resolveDefaultLenses` in `@diffgazer/core`

**Decision**: Extract `resolveDefaultLenses` + `FALLBACK_LENSES` to `packages/core/src/review/` (the domain logic package).

**Rationale**: The function validates lens IDs using `LensIdSchema` from `@diffgazer/schemas` and returns domain objects. This is pure business logic, not a React hook or API concern. Both the `LensIdSchema` and `FALLBACK_LENSES` are domain concepts that belong in the core package alongside the existing `reviewReducer`.

**Alternatives considered**:
- Place in `@diffgazer/api/hooks`: rejected because it has no dependency on React, hooks, or the API client
- Place in `@diffgazer/schemas`: rejected because it's logic, not a schema definition

## Decision 6: Streaming Hook — Both Functions Return `void`

**Decision**: Make both `start` and `resume` return `void`. Remove the `Result` return from `resume`.

**Rationale**: The hook already manages all state via `useReducer` dispatch. Errors are always dispatched to state regardless of the return value. Having `resume` also return a `Result` creates a dual error reporting path that confuses consumers (do they check the return value OR the state?). The CLI's `use-review-lifecycle.ts` already uses `void stream.start(...)`, showing that state-based error handling is the expected pattern.

**Alternatives considered**:
- Both return `Result`: rejected because it would duplicate the error information already in state, and `start` would need a significant rewrite to support this
- Keep inconsistent: rejected because it violates KISS and creates confusion for future developers

## Finding 7: Mutation Invalidation Promises Already Correct

**Finding**: The initial assessment that mutation hooks don't return invalidation promises was **incorrect**. Detailed file-level audit of all 11 mutation hooks confirmed:
- 7 hooks use concise arrow expressions (`() => qc.invalidateQueries(...)`) which implicitly return the promise
- 3 hooks use `async/await` with `Promise.all` which explicitly returns the promise
- 1 hook (`useShutdown`) has no `onSuccess` (correct — shutdown has nothing to invalidate)

**Implication**: US6 / FR-009 / SC-006 in the spec are already satisfied. No changes needed.

## CLI-Web Parity Assessment

Full 1:1 screen parity confirmed (14 web routes, all matched to CLI screens):

| Difference | Impact | Action |
| ---------- | ------ | ------ |
| Web help page is a stub | Low (not in scope) | Noted, not addressed in this spec |
| Onboarding step order differs | Low (cosmetic) | Noted, not addressed in this spec |
| CLI history screen has 2-pane vs web's 3-pane | Low (layout choice) | Noted, not addressed in this spec |
| Web review page uses direct `api.getReview()` | Documented intentional bypass | No action needed |

No parity gaps that require action in this audit.
