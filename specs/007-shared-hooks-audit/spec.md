# Feature Specification: Shared API Hooks Quality Audit & Improvement

**Feature Branch**: `007-shared-hooks-audit`
**Created**: 2026-03-24
**Status**: Draft
**Input**: Audit the shared API hooks implementation (006-shared-api-hooks) for quality, correctness, and adherence to DRY/KISS/YAGNI principles. Fix identified issues, consolidate duplicated code between CLI and web, and verify full CLI-web parity. Research whether additional libraries or patterns could reduce boilerplate.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Fix Query Key Hierarchy Bug (Priority: P1)

As a developer using the shared hooks, I need cache invalidation to work correctly so that when I delete a review, the review list is properly refreshed without relying on hardcoded query key strings.

**Why this priority**: The `reviewQueries.list` key uses `["reviews", projectPath]` instead of `["review", "list", projectPath]`, breaking the hierarchical invalidation pattern. Invalidating `reviewQueries.all()` (`["review"]`) does NOT invalidate the review list. The `use-delete-review` mutation works around this with a hardcoded `["reviews"]` string instead of using the factory. This is a correctness bug that could cause stale data after mutations.

**Independent Test**: Can be tested by calling `reviewQueries.all()` and verifying it is a prefix of `reviewQueries.list().queryKey`. Then calling `queryClient.invalidateQueries({ queryKey: reviewQueries.all() })` and verifying the review list query is also invalidated.

**Acceptance Scenarios**:

1. **Given** a review list has been fetched and cached, **When** `queryClient.invalidateQueries({ queryKey: reviewQueries.all() })` is called, **Then** the review list query is also invalidated and refetched.
2. **Given** a review is deleted via `useDeleteReview`, **When** the mutation succeeds, **Then** the review list is invalidated using the `reviewQueries` factory (no hardcoded key strings), and the list refreshes showing the review removed.

---

### User Story 2 - Consolidate Duplicated Platform Wrappers (Priority: P1)

As a developer maintaining diffgazer, I want the `useServerStatus` wrapper to exist in one place so that I don't need to update identical logic in both CLI and web when the server status mapping changes.

**Why this priority**: The `useServerStatus` platform wrapper (maps query result to `{ state: "checking" | "connected" | "error", retry }`) is duplicated nearly identically between CLI (19 lines) and web (22 lines). The logic is the same. Additionally, the CLI diagnostics screen reimplements this same mapping a third time instead of using either wrapper. This is a DRY violation that increases the risk of divergent behavior.

**Independent Test**: Can be tested by importing the consolidated `useServerStatus` from the shared package in both apps and verifying both receive the same `{ state, retry }` shape with identical transitions (loading->checking, success->connected, error->error).

**Acceptance Scenarios**:

1. **Given** the server is reachable, **When** both apps call the shared `useServerStatus`, **Then** both receive `{ state: "connected" }` from a single implementation.
2. **Given** the server is unreachable, **When** both apps call the shared `useServerStatus`, **Then** both receive `{ state: "error", retry }` with the same retry function.
3. **Given** the CLI diagnostics screen needs server status, **When** it renders, **Then** it uses the shared `useServerStatus` hook instead of deriving status from the raw query result.

---

### User Story 3 - Fix Streaming Hook API Inconsistency (Priority: P2)

As a developer consuming the review stream hook, I need a consistent API for error handling so that I know whether to check the return value or the state for errors.

**Why this priority**: The `useReviewStream` hook's `start` function returns `Promise<void>` (errors only available via state), while `resume` returns `Promise<Result<void, StreamReviewError>>` (errors available both via return value and state). This inconsistency forces consumers to guess which error path to use. The streaming hook is the most complex shared hook (170 lines) and the primary code review workflow.

**Independent Test**: Can be tested by calling `start` and `resume` on the same hook instance and verifying both have the same return type and error reporting mechanism.

**Acceptance Scenarios**:

1. **Given** the streaming hook is used, **When** `start` encounters an error, **Then** the error is reported through the same mechanism as `resume` errors (either both return `Result` or both return `void` with state-only errors).
2. **Given** the streaming hook's `stop` and `abort` functions are called, **Then** the shared abort logic (abort controller cleanup) is not duplicated between them.

---

### User Story 4 - Consolidate Duplicated Review Settings Logic (Priority: P2)

As a developer, I want the default lenses resolution logic to exist in one place so that both CLI and web resolve lenses identically.

**Why this priority**: The `resolveDefaultLenses` function (filters `settings.defaultLenses` through `LensIdSchema.safeParse`, falls back to `FALLBACK_LENSES`) is duplicated between CLI's `use-review-lifecycle.ts` and web's `use-review-settings.ts`. Both apps depend on identical lens validation logic for the review workflow.

**Independent Test**: Can be tested by importing the shared `resolveDefaultLenses` utility and verifying it returns validated lens IDs or the fallback array.

**Acceptance Scenarios**:

1. **Given** valid lenses in settings, **When** `resolveDefaultLenses` is called with settings data, **Then** it returns the validated lens IDs.
2. **Given** invalid or missing lenses, **When** `resolveDefaultLenses` is called, **Then** it returns the fallback lenses array.
3. **Given** both CLI and web start a review, **When** they resolve default lenses, **Then** both use the single shared implementation.

---

### User Story 5 - Complete Query Factory Consistency (Priority: P3)

As a developer adding new queries to the shared hooks, I want all query factories to follow the same structure so that invalidation patterns are predictable.

**Why this priority**: `serverQueries` and `gitQueries` lack the `all()` factory method that every other query factory provides. This inconsistency means there is no way to invalidate all server or git queries at once, and breaks the pattern a developer would expect when adding new queries to these domains.

**Independent Test**: Can be tested by verifying every query factory exports an `all()` method that returns a key prefix, and that all queries within the factory use this prefix.

**Acceptance Scenarios**:

1. **Given** `serverQueries`, **When** its structure is inspected, **Then** it has an `all()` method and `health` key uses it as a prefix.
2. **Given** `gitQueries`, **When** its structure is inspected, **Then** it has an `all()` method and both `status` and `diff` keys use it as a prefix.

---

### User Story 6 - Ensure Mutation Invalidation Promises Are Returned (Priority: P3)

As a user of diffgazer, I want the UI to stay in a loading state until refetched data is available so that I don't see stale data flash briefly after a mutation.

**Why this priority**: Mutation hooks' `onSuccess` callbacks trigger `invalidateQueries` but do not return the promise. This means `isPending` flips to `false` before the invalidation refetch completes, potentially causing a brief flash of stale data in the UI.

**Independent Test**: Can be tested by executing a mutation and verifying that `isPending` remains `true` until both the mutation AND the subsequent cache invalidation refetch complete.

**Acceptance Scenarios**:

1. **Given** a mutation is executed (e.g., `useSaveSettings`), **When** it succeeds, **Then** `isPending` remains `true` until the invalidated queries finish refetching.
2. **Given** multiple queries are invalidated by one mutation (e.g., `useActivateProvider` invalidates providers + init), **When** the mutation succeeds, **Then** `isPending` remains `true` until all invalidated queries finish refetching.

---

### Edge Cases

- What happens if the shared `useServerStatus` hook is used in a context where the health gate has not yet mounted? The hook must return a valid `checking` state immediately without errors.
- What happens if `resolveDefaultLenses` receives an empty array? It should return the fallback lenses, not an empty array.
- What happens if query key hierarchy changes break existing cached data? Cache is ephemeral (in-memory only), so key changes take effect immediately on next app start with no migration needed.
- What happens if returning the invalidation promise from `onSuccess` causes unhandled rejections when the refetch fails? The data fetching library catches refetch errors and surfaces them through the query's error field, not through the mutation's promise chain.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The review list query factory MUST use the review `all()` prefix in its query key so that invalidating all review queries also invalidates the review list.
- **FR-002**: The review deletion mutation MUST use the query factory for invalidation instead of hardcoded query key strings.
- **FR-003**: The server status wrapper (mapping query result to `{ state: "checking" | "connected" | "error", retry }`) MUST be consolidated into a single shared implementation, eliminating duplicate implementations in CLI and web.
- **FR-004**: The CLI diagnostics screen MUST use the shared server status hook instead of deriving server status from the raw query result.
- **FR-005**: The streaming hook's `start` and `resume` functions MUST have consistent return types and error reporting mechanisms.
- **FR-006**: The shared abort logic in the streaming hook (`stop` and `abort` both abort the controller and null the ref) MUST be extracted to avoid duplication.
- **FR-007**: The `resolveDefaultLenses` function MUST be extracted to a shared location and consumed by both CLI and web.
- **FR-008**: All query key factories MUST include an `all()` method for hierarchical invalidation consistency.
- **FR-009**: All mutation hooks' `onSuccess` callbacks MUST return the invalidation promise so that the pending state reflects the full mutation-plus-refetch lifecycle.
- **FR-010**: Both CLI and web MUST continue to pass all existing tests after changes, with no regressions in user-facing behavior.

### Key Entities

- **Query Key Factory**: An object that defines hierarchical query keys with an `all()` root and domain-specific sub-keys. Used for both querying and targeted cache invalidation.
- **Platform Wrapper**: A hook that composes a shared hook with platform-specific behavior. Lives in the app directory when truly platform-specific, or in the shared package when the logic is identical across platforms.
- **Invalidation Promise**: The promise returned by the cache invalidation call. When returned from a mutation's success callback, it keeps the mutation's pending state `true` until refetched data is available.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Zero hardcoded query key strings in mutation hooks — all invalidation uses factory methods.
- **SC-002**: The server status wrapper exists in exactly one location (shared package), with zero duplicate implementations across CLI and web.
- **SC-003**: The `resolveDefaultLenses` function exists in exactly one location, consumed by both apps.
- **SC-004**: All query key factories include an `all()` method — verified by inspecting every query factory file.
- **SC-005**: The streaming hook's public API functions (`start`, `resume`, `stop`, `abort`) have consistent signatures with no duplicated internal logic.
- **SC-006**: After a mutation completes, stale data flash does not occur — the pending state stays `true` until refetched data is available.
- **SC-007**: Both CLI and web pass all existing tests with zero regressions.
- **SC-008**: Full CLI-web screen parity is maintained — every web route has a corresponding CLI screen with equivalent data fetching via shared hooks.

## Assumptions

- The existing thin wrapper hooks pattern (one hook per query/mutation, each ~5 lines) is acceptable and does not need to be replaced with a factory generator or codegen tool. Research confirmed that the current pattern is canonical for the data fetching library used, and the library maintainer recommends it over wrapper libraries. The total boilerplate is ~150 lines across all hooks — not enough to justify adding a dependency.
- No additional data fetching library is needed. Research evaluated query key factory libraries (superseded by built-in utilities), alternative hook kit libraries (conflicts with context injection pattern), Suspense wrapper libraries (marginal value over built-in Suspense support), end-to-end type-safe RPC frameworks (requires server rewrite), and OpenAPI codegen tools (require OpenAPI spec). None provide sufficient value for the current architecture.
- The current data fetching library with `networkMode: 'always'` remains the correct approach for terminal environments. No terminal-specific data fetching library exists.
- The server status wrapper logic (mapping query state to checking/connected/error discriminated union) is identical between CLI and web and can be safely moved to the shared package without breaking either app's health gate component.
- Cache is ephemeral (in-memory), so query key hierarchy changes take effect immediately on next app start. No data migration is needed when fixing the review list query key.

## Research Findings Summary

### Libraries Evaluated

| Library | Verdict | Reason |
| ------- | ------- | ------ |
| Query key factory lib | Not needed | Superseded by built-in query options utility. Last release ~2 years ago. |
| React query kit | Not recommended | Conflicts with context-injected API pattern. Adds wrapper over first-party API. |
| Suspense query wrappers | Future consideration | Built-in Suspense query support already exists. Only adds value with Suspense-first architecture. |
| End-to-end RPC framework | Too invasive | Would eliminate hooks layer entirely but requires server rewrite. |
| OpenAPI codegen tools | Requires OpenAPI spec | Would auto-generate entire API+hooks layer, but no OpenAPI spec exists. |
| React 19 `use()` | Not a replacement | No caching, deduplication, retry, or invalidation. Only for one-shot reads. |

### Current Implementation Quality Assessment

**What's excellent:**
- Query options factory pattern is canonical for the data fetching library (confirmed by maintainer's blog and official docs)
- Cross-platform architecture (shared hooks + platform-specific client configs) is the recommended approach
- Peer dependencies with `optional: true` correctly isolates React from the transport layer
- Streaming hook correctly avoids the query/mutation pattern (SSE doesn't fit that model)
- Web config provider correctly simplified to compose shared hooks
- No hand-rolled loading/error state patterns remain in either app
- Full 1:1 screen parity between web and CLI (14 routes, all matched)

**What needs fixing (6 user stories in this spec):**
- Query key hierarchy bug (review list disconnected from review `all()`)
- Duplicated server status wrapper across CLI and web (+ third reimplementation in CLI diagnostics)
- Duplicated `resolveDefaultLenses` logic across CLI and web
- Inconsistent streaming hook API (`start` vs `resume` return types)
- Duplicated abort logic in streaming hook (`stop`/`abort`)
- Missing `all()` factories in server and git query groups
- Mutation success callbacks don't return invalidation promise
