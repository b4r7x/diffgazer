# Feature Specification: Shared API Hooks Quality Validation & Pattern Audit

**Feature Branch**: `009-hooks-quality-validation`
**Created**: 2026-03-25
**Status**: Draft
**Input**: Comprehensive quality review and pattern validation of shared API hooks architecture. Validate matchQueryState as a React pattern (re-renders, performance). Audit for anti-slop, DRY, KISS, YAGNI violations. Research additional libraries for loading state management. Ensure state-of-the-art implementation quality.

## Context

The shared API hooks architecture (`@diffgazer/api/hooks`) was implemented across three specs:
- **006-shared-api-hooks**: Created shared TanStack Query hooks, ApiProvider, query factories, streaming hook
- **007-shared-hooks-audit**: Fixed query key hierarchy bug, consolidated useServerStatus, fixed streaming hook API, extracted resolveDefaultLenses, added missing `all()` factories, returned invalidation promises
- **008-hooks-consolidation**: Consolidated 25+ files into 8, removed 6 unused hooks, renamed query files, introduced `matchQueryState()` utility

This spec validates the completed implementation against React 19 best practices, TanStack Query canonical patterns, and software quality principles (DRY, KISS, YAGNI, SRP, anti-slop).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Validate matchQueryState Pattern (Priority: P1)

As a developer using `matchQueryState()` in both web (React DOM) and CLI (Ink) components, I need confirmation that this pattern does not cause unnecessary re-renders, is compatible with React 19 Compiler, and follows established React patterns.

**Why this priority**: `matchQueryState` is a core utility used across both apps. If it causes performance issues or is incompatible with React 19 Compiler, every component using it is affected. The pattern is non-standard (a pure function returning ReactNode during render), so validation is essential before wider adoption.

**Independent Test**: Can be tested by rendering a component that uses `matchQueryState` with React DevTools Profiler and verifying no unnecessary re-renders occur when the query state doesn't change.

**Acceptance Scenarios**:

1. **Given** a component using `matchQueryState` with a query in "success" state, **When** the parent component re-renders for unrelated reasons, **Then** the component does not create new ReactNode instances unless the query state actually changed.
2. **Given** the handlers object contains inline arrow functions, **When** React 19 Compiler processes the component, **Then** the compiler auto-memoizes the handlers and `matchQueryState` output correctly.
3. **Given** the guard clause pattern (`const guard = matchQueryState(...); if (guard) return guard;`), **When** query transitions from loading to success, **Then** React reconciliation correctly unmounts the loading tree and mounts the content tree without DOM/terminal artifacts.
4. **Given** a query with both stale `data` and a refetch `error` (RefetchErrorResult), **When** `matchQueryState` evaluates the query, **Then** the `success` handler is called with the stale data (data-first check order), not the `error` handler.

---

### User Story 2 - Verify Hooks Follow TanStack Query Canonical Patterns (Priority: P1)

As a developer maintaining the hooks package, I need assurance that query key factories, mutation invalidation, and hook composition follow TanStack Query v5's recommended patterns (as documented by TkDodo and official docs).

**Why this priority**: Deviating from canonical patterns means the team misses out on built-in optimizations and makes the code harder for developers familiar with TanStack Query to understand. Canonical patterns are also more likely to survive major version upgrades.

**Independent Test**: Can be tested by comparing each hook's structure against the patterns documented in TanStack Query's official examples and TkDodo's blog.

**Acceptance Scenarios**:

1. **Given** all query factories use `queryOptions()`, **When** their structure is inspected, **Then** each factory co-locates key, queryFn, and staleTime in a single object following the factory pattern from TanStack Query v5 docs.
2. **Given** all mutation hooks invalidate queries on success, **When** each mutation's `onSuccess` is inspected, **Then** invalidation uses query factory methods (not hardcoded strings) and returns the invalidation promise.
3. **Given** `useApi()` is called inside every hook, **When** the hooks package is analyzed, **Then** no hook stores or closes over the API instance outside of TanStack Query's `queryFn`.

---

### User Story 3 - Audit for Anti-Slop and Code Quality (Priority: P2)

As a code quality reviewer, I want to verify the hooks implementation has no AI-generated slop patterns (unnecessary comments, over-engineering, defensive over-coding, verbose patterns, dead code, type workarounds) and follows DRY, KISS, YAGNI, and SRP principles.

**Why this priority**: The hooks were generated across three spec iterations. AI-generated code tends to accumulate unnecessary abstractions, defensive patterns, and verbose commentary over multiple passes. Catching slop now prevents it from becoming the norm.

**Independent Test**: Can be tested by running an automated slop detector on all hooks files and manually reviewing flagged patterns.

**Acceptance Scenarios**:

1. **Given** all hooks files, **When** audited for unnecessary comments, **Then** no comments explain obvious code (e.g., "// Call the API" before `api.getSettings()`).
2. **Given** mutation hooks follow a repeating pattern (useApi, useQueryClient, useMutation with invalidation), **When** evaluated for DRY, **Then** the repetition is intentional (each mutation has unique invalidation targets) and not extractable without losing clarity.
3. **Given** the hooks package, **When** inspected for YAGNI violations, **Then** no unused exports, parameters, or generics exist beyond what consumers actually use.
4. **Given** the hooks package, **When** line count is measured, **Then** total implementation code (excluding tests and types) is within 15% of the theoretical minimum for the same functionality.

---

### User Story 4 - Research and Compare Alternative Loading State Patterns (Priority: P3)

As a developer evaluating the hooks architecture, I want to understand whether `matchQueryState` is the best approach or if alternatives (Suspense, ts-pattern, useSuspenseQuery) would be better for this dual-platform (web + Ink) context.

**Why this priority**: The loading state pattern affects developer ergonomics across the entire app. If a better approach exists, it's worth knowing, but the current approach works, so this is research-only with no obligation to change.

**Independent Test**: Can be tested by implementing the same component with matchQueryState and with the alternative pattern, then comparing code readability, type safety, and platform compatibility.

**Acceptance Scenarios**:

1. **Given** TanStack Query's `useSuspenseQuery` is an alternative, **When** its Ink compatibility is evaluated, **Then** a clear determination is made on whether Ink 6 supports Suspense boundaries sufficiently for production use.
2. **Given** pattern matching libraries like `ts-pattern` exist, **When** compared to `matchQueryState`, **Then** the comparison documents: bundle size impact, type inference quality, and whether the dependency is justified for this use case.
3. **Given** React 19's `use()` hook, **When** evaluated as an alternative to TanStack Query for simple queries, **Then** a clear statement is made on why it is or isn't suitable (caching, deduplication, retry).

---

### Edge Cases

- What happens if `matchQueryState` is called with a query that has both `error` and stale `data`? The current implementation prioritizes error over stale data, which may hide previously valid data during transient errors.
- What happens if React 19 Compiler cannot optimize the handlers object (e.g., if it captures a closure over rapidly-changing state)? The function should still work correctly, just without memoization benefits.
- What happens if `useApi()` is called in a component that renders before `ApiProvider` mounts (race condition during app initialization)? The thrown error should be caught by the nearest Error Boundary.
- What happens if a mutation's `onSuccess` invalidation fails (network error during refetch)? TanStack Query surfaces this through the query's error state, not the mutation's.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: `matchQueryState` MUST NOT cause unnecessary React re-renders when the underlying query state hasn't changed
- **FR-002**: `matchQueryState` MUST be compatible with React 19 Compiler auto-memoization
- **FR-003**: All query key factories MUST follow the hierarchical pattern with `all()` root and domain-specific sub-keys
- **FR-004**: All mutation hooks MUST return the invalidation promise from `onSuccess` to keep `isPending` accurate
- **FR-005**: The hooks package MUST have zero unnecessary comments, dead code, unused exports, or AI-generated slop patterns
- **FR-006**: Each hook MUST follow a consistent structure: import useApi, spread query factory, return result
- **FR-007**: The streaming hook (`useReviewStream`) MUST use `useReducer` (not TanStack Query) and MUST properly clean up AbortControllers
- **FR-008**: A research report MUST document the comparison between `matchQueryState` and at least 3 alternative patterns, with a clear recommendation

### Key Entities

- **matchQueryState**: A pure function that maps `UseQueryResult<T>` to render callbacks, used as a guard clause pattern in both web and CLI components
- **Query Factory**: A configuration object (`queryOptions()`) that co-locates query key, fetch function, and cache policy
- **Hook Composition**: The pattern where each hook calls `useApi()` + spreads a query factory into `useQuery`/`useMutation`
- **Guard Clause Pattern**: Using `matchQueryState` to handle loading/error states, returning early, and letting the rest of the component assume data is available

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: matchQueryState validation confirms zero unnecessary re-renders in both web and CLI rendering contexts
- **SC-002**: All hooks pass canonical TanStack Query pattern review with zero deviations from official recommended practices
- **SC-003**: Anti-slop audit identifies zero critical issues; any info-level findings are documented with rationale for keeping or fixing
- **SC-004**: Research report provides a clear recommendation on matchQueryState vs alternatives with supporting evidence from official documentation and community practices
- **SC-005**: Both CLI and web apps continue to pass all existing tests and build successfully
- **SC-006**: Code quality score of the hooks package is 9/10 or higher on a standardized review rubric

## Assumptions

- The hooks package (specs 006-008) is fully implemented and merged. This spec is purely a validation and audit exercise with no structural changes expected unless critical issues are found.
- React 19 Compiler is active in this project. Manual `useCallback`/`useMemo` are not used (project convention from CLAUDE.md).
- `matchQueryState` is a pure function called during render, not a hook. It doesn't use any React hooks internally, making it safe to call conditionally.
- The "guard clause" pattern (early return for loading/error, then render content) is an established React pattern used in many production codebases.
- Ink 6 is a React 19 renderer. Any React pattern that doesn't depend on DOM APIs should work in Ink. Suspense support in Ink may be limited.
- TanStack Query v5 with `networkMode: 'always'` is confirmed to work in non-browser environments. No alternative is needed for the terminal runtime.
