# Feature Specification: Shared API Hooks & Unified Data Fetching

**Feature Branch**: `006-shared-api-hooks`
**Created**: 2026-03-24
**Status**: Draft
**Input**: Consolidate API hooks from CLI into shared @diffgazer/api package, add data fetching library (TanStack Query) for unified loading/error state management across web (React) and CLI (Ink).

## Clarifications

### Session 2026-03-24

- Q: How do shared hooks access the platform-specific `api` instance (CLI uses `projectRoot`, web uses browser origin)? → A: React context — a shared `ApiProvider` wraps the app tree, hooks read the `api` instance from context.
- Q: What happens to the web's ConfigProvider when TanStack Query is introduced (it has its own caching, split contexts, mutation handling)? → A: Simplify — ConfigProvider stays as a thin wrapper that composes shared TanStack Query hooks and exposes derived state (e.g., "is any provider configured?"). Its data fetching and caching responsibilities are replaced by TanStack Query.
- Q: Should ALL API write operations become shared `useMutation` hooks, or only those currently used by both apps? → A: All mutations — every API write operation becomes a shared `useMutation` hook, providing complete coverage and preventing future duplication as CLI features grow.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Shared Data Fetching Hooks Across Web and CLI (Priority: P1)

As a developer working on diffgazer, I want a single set of API data-fetching hooks shared between the web app and CLI so that when I add or modify an API call, I only change one place instead of maintaining duplicate logic in both apps.

**Why this priority**: This is the core value proposition. Today there are 5 API-calling hooks in CLI and 20+ in web, many with identical logic (useServerStatus, useSettings, useInit, useReviewStream). Duplication causes bugs when one app is updated but not the other, and doubles development effort for every new feature.

**Independent Test**: Can be tested by importing a shared hook (e.g., useSettings) in both a web component and an Ink component, verifying both receive the same data shape, loading states, and error handling from a single implementation.

**Acceptance Scenarios**:

1. **Given** a shared `useSettings` hook in `@diffgazer/api`, **When** the web app and CLI app both import and call it, **Then** both receive identical `{ data, isLoading, error, refetch }` return shapes with the same caching and error behavior.
2. **Given** a shared `useServerStatus` hook, **When** the server is unreachable, **Then** both web and CLI show the same error state transitions (checking -> error) without separate implementations.
3. **Given** a developer adds a new API endpoint, **When** they create a hook for it in the shared package, **Then** both web and CLI apps can use it without writing platform-specific data fetching code.

---

### User Story 2 - Automatic Loading, Error, and Caching via Data Fetching Library (Priority: P2)

As a developer, I want a data fetching library (TanStack Query) integrated into both apps so that I don't have to manually write `useState`/`useEffect` patterns for loading states, error handling, caching, and request deduplication every time I add a new API call.

**Why this priority**: Currently every hook manually implements the same `{ data, isLoading, error }` pattern with `useState` + `useEffect` + try/catch/finally. This is 15-30 lines of boilerplate per hook. A data fetching library eliminates this entirely, provides automatic caching, request deduplication, retry logic, and stale-while-revalidate out of the box.

**Independent Test**: Can be tested by replacing one existing hand-rolled hook (e.g., useSettings) with TanStack Query's `useQuery` and verifying it still works in both web and CLI with zero hand-written loading/error state management.

**Acceptance Scenarios**:

1. **Given** TanStack Query is configured in both apps, **When** a hook uses `useQuery` to fetch settings, **Then** the hook automatically provides `isLoading`, `error`, `data`, and `refetch` without any manual `useState`/`useEffect` code.
2. **Given** two components in the same app call `useSettings` simultaneously, **When** both mount, **Then** only one network request is made (request deduplication), and both components receive the same cached result.
3. **Given** a query has been fetched and cached, **When** the same query is requested again within the cache window, **Then** the cached result is returned immediately without a new network request.
4. **Given** a network request fails, **When** the retry limit is reached, **Then** the error is surfaced through the hook's `error` field without manual try/catch in the consuming component.

---

### User Story 3 - TanStack Query Working in Ink Terminal Environment (Priority: P2)

As a developer, I want TanStack Query to work correctly in the Ink (Node.js terminal) environment without browser-specific behavior (window focus refetching, online/offline detection) so that the CLI app benefits from the same data fetching infrastructure as the web app.

**Why this priority**: TanStack Query defaults assume a browser environment. Without proper configuration, it would crash or behave unexpectedly in Node.js (no `window`, no `document`, no `requestAnimationFrame`). This is a prerequisite for Story 2 working in CLI.

**Independent Test**: Can be tested by wrapping an Ink app in TanStack Query's `QueryClientProvider` with terminal-appropriate configuration and running a query that fetches from the local server.

**Acceptance Scenarios**:

1. **Given** TanStack Query is configured with `networkMode: 'always'` and `refetchOnWindowFocus: false`, **When** the CLI app runs in a terminal, **Then** queries execute normally without errors about missing browser APIs.
2. **Given** the terminal loses and regains network, **When** a query is in-flight, **Then** the query fails gracefully with an error state (no crash from missing `navigator.onLine`).
3. **Given** the CLI app is running, **When** a query completes successfully, **Then** subsequent calls to the same query within the stale time return cached data, just as they would in the web app.

---

### User Story 4 - Platform-Specific Adapters for Shared Hooks (Priority: P3)

As a developer, I want a clear pattern for hooks that need slight platform differences (e.g., navigation after config check, event batching in streaming) so that the shared core logic remains unified while platform-specific behavior is injectable.

**Why this priority**: Not all hooks are 100% identical. Web uses TanStack Router navigation, CLI uses custom navigation context. Web batches stream events with `requestAnimationFrame`, CLI doesn't. These differences must be accommodated without forking the entire hook.

**Independent Test**: Can be tested by providing a shared `useConfigGuard` hook that accepts a platform-specific `onNotConfigured` callback, verifying web passes a router navigate and CLI passes a screen navigation function.

**Acceptance Scenarios**:

1. **Given** a shared hook accepts a platform-specific callback (e.g., `onNavigate`), **When** the web app provides its router-based navigation and the CLI provides its screen-based navigation, **Then** both apps handle the "not configured" case correctly using their own navigation mechanism.
2. **Given** the review stream hook supports an optional event batching strategy, **When** the web app provides `requestAnimationFrame`-based batching and CLI provides synchronous dispatch, **Then** both apps process stream events correctly with their preferred batching approach.

---

### Edge Cases

- What happens when the CLI app starts before the server is ready? Hooks should return loading/error states without crashing. TanStack Query's retry logic handles transient failures.
- What happens if the shared package depends on React features not available in Ink? All shared hooks must use only React core APIs (`useState`, `useEffect`, `useReducer`, `useSyncExternalStore`) — no DOM-specific hooks.
- What happens when both apps have different cache invalidation needs? The shared hooks expose `refetch` and `invalidateQueries` — platform-specific code triggers invalidation when appropriate (e.g., after mutations).
- What happens with streaming (SSE) which doesn't fit the typical request/response `useQuery` pattern? Streaming hooks remain as shared `useReducer`-based hooks; TanStack Query is used for non-streaming CRUD operations only.
- What happens if TanStack Query is added as a dependency to `@diffgazer/api` but a consumer doesn't use React? The hooks subpath export is separate from the transport-only export — non-React consumers import only `@diffgazer/api` (transport), while React consumers import `@diffgazer/api/hooks`.
- What happens if the `ApiProvider` context is missing when a shared hook is called? Hooks MUST throw a clear error ("useApi must be used within an ApiProvider") at call time rather than failing silently.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The `@diffgazer/api` package MUST export shared React hooks (e.g., `useSettings`, `useServerStatus`, `useInit`, `useReviews`, `useReviewDetail`) that both web and CLI apps can import.
- **FR-002**: Shared hooks MUST use TanStack Query's `useQuery` and `useMutation` for all non-streaming CRUD API operations, eliminating manual `useState`/`useEffect` boilerplate.
- **FR-003**: TanStack Query MUST be configured to work in Node.js terminal environments (Ink) with `networkMode: 'always'`, `refetchOnWindowFocus: false`, and `refetchOnReconnect: false`.
- **FR-004**: Both apps MUST wrap their root component in a `QueryClientProvider` with appropriate default configuration.
- **FR-005**: Shared hooks MUST return a consistent shape (TanStack Query's standard `useQuery`/`useMutation` return values) so both apps can consume them identically.
- **FR-006**: Hooks that require platform-specific behavior (navigation, event batching, toast notifications) MUST accept callbacks or options to inject that behavior, rather than importing platform-specific modules directly.
- **FR-007**: The streaming review hook (`useReviewStream`) MUST remain as a shared `useReducer`-based hook (not TanStack Query) since SSE streaming doesn't fit the query/mutation pattern. It MUST be extracted to the shared package alongside the existing shared `reviewReducer` from `@diffgazer/core/review`.
- **FR-008**: Every API write operation MUST have a corresponding shared `useMutation` hook with automatic cache invalidation on success. This includes all config, settings, provider, review, trust, and shutdown mutations — not just those currently used by both apps.
- **FR-009**: The shared hooks MUST work with the existing `createApi()` transport layer — TanStack Query's `queryFn` calls the existing bound API methods.
- **FR-010**: Both apps MUST be migrated from their hand-rolled hooks to the shared hooks, with app-specific hook files either removed or reduced to thin wrappers around shared hooks.
- **FR-011**: The `@diffgazer/api` package MUST export a shared `ApiProvider` React context that accepts a `BoundApi` instance. Both apps wrap their component tree in `ApiProvider`, and all shared hooks read the `api` instance from this context. Hooks MUST throw a descriptive error if called outside the provider.
- **FR-012**: The web app's `ConfigProvider` MUST be simplified to a thin wrapper that composes shared TanStack Query hooks (e.g., `useInit`, `useActivateProvider`) and exposes only derived/composed state (e.g., "is any provider configured?"). Its current data fetching, module-level TTL caching, and request deduplication logic MUST be removed in favor of TanStack Query's built-in equivalents.

### Key Entities

- **Shared Hook**: A React hook in `@diffgazer/api` that uses TanStack Query to call a bound API method and return standardized loading/error/data states. Consumed by both web and CLI apps.
- **ApiProvider**: A React context provider exported from `@diffgazer/api` that holds the platform-specific `BoundApi` instance. Each app creates its own `api` via `createApi()` with platform-appropriate config, then passes it to `ApiProvider`. Shared hooks consume the `api` from this context.
- **QueryClient Configuration**: Platform-specific TanStack Query configuration that disables browser-specific behaviors for the CLI while preserving them for the web.
- **Platform Adapter**: A callback or options object passed to a shared hook to inject platform-specific behavior (navigation, toasts, event batching).
- **Query Key**: A unique identifier for each query used by TanStack Query for caching, deduplication, and invalidation. Defined once per shared hook.
- **ConfigProvider (simplified)**: A web-only React context that composes shared TanStack Query hooks and exposes derived state (e.g., combined provider/config readiness). No longer owns data fetching or caching — those responsibilities move to TanStack Query.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The number of duplicated API-calling hook implementations across web and CLI is reduced by at least 80% — most hooks exist only once in the shared package.
- **SC-002**: Adding a new API-fetching hook requires writing it once in the shared package, not twice in each app. Developer effort for new API integrations is halved.
- **SC-003**: All hand-rolled `useState`/`useEffect` loading/error patterns in non-streaming hooks are replaced by TanStack Query, reducing per-hook boilerplate by 15-30 lines.
- **SC-004**: Both web and CLI apps pass all existing tests after migration to shared hooks, with no regressions in user-facing behavior.
- **SC-005**: The CLI app (Ink) runs without browser API errors — no references to `window`, `document`, or `navigator` at runtime.
- **SC-006**: Request deduplication is verified: when two components call the same query, only one network request is made.
- **SC-007**: Cache behavior works identically across both apps — repeated calls within the stale time return cached data without network requests.

## Assumptions

- TanStack Query v5's React binding works with Ink 6 since Ink is a React 19 renderer and TanStack Query relies only on React core hooks (no DOM APIs). This is supported by TanStack Query's React Native compatibility (another non-DOM renderer) and the availability of `networkMode: 'always'` to bypass browser connectivity checks.
- The existing `@diffgazer/api` package is the right place for shared hooks because it already owns the API client and transport layer. Adding React hooks here keeps the "API connection" concern cohesive. Both apps already depend on this package.
- Streaming hooks (SSE-based review stream) will NOT use TanStack Query — they remain `useReducer`-based because TanStack Query's query/mutation model doesn't fit long-running event streams. These will still be extracted to the shared package.
- The `packages/hooks` package (currently containing only `useTimer` and `getFigletText`) is NOT the target for shared API hooks. API hooks belong in `@diffgazer/api` because they are tightly coupled to the API client, not generic utilities.
- SWR was considered as an alternative (4KB vs 13KB) but TanStack Query was chosen because: (1) richer feature set (mutations, optimistic updates, cache invalidation), (2) TanStack Router already used in the web app (ecosystem synergy), (3) better TypeScript support, (4) explicit `networkMode: 'always'` for non-browser environments.
