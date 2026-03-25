# Feature Specification: Shared API Hooks Consolidation

**Feature Branch**: `008-hooks-consolidation`
**Created**: 2026-03-25
**Status**: Draft
**Input**: Audit and consolidate shared API hooks: remove .queries suffix, eliminate thin wrappers, delete unused hooks, consolidate by domain, improve loading state patterns

## Clarifications

### Session 2026-03-25

- Q: Should unused hooks be removed entirely or should some (especially `useRunDrilldown` which has a complete backend) be connected to the UI instead? Should backend endpoints also be removed? → A: Remove all 6 hooks from the shared package. Keep all backend endpoints intact for future use.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Remove Dead Code from Shared Hooks (Priority: P1)

A developer working in the codebase encounters 6 hooks that are exported but never imported by either the CLI or web app. These hooks were created speculatively during `006-shared-api-hooks` (one hook per `BoundApi` method) but their corresponding UI features either don't exist or get the same data a different way. All backend endpoints remain intact for future use -- only the unused hook wrappers and their public re-exports are removed.

**Why this priority**: Dead code is the highest-confidence change -- it has zero risk of breaking consumers since nothing uses it. It immediately reduces the codebase size and clarifies the actual public API surface.

**Independent Test**: After removal, both CLI and web apps build successfully, all existing tests pass, and no import errors occur. The removed hooks are confirmed absent from all consumer code.

**Acceptance Scenarios**:

1. **Given** the shared hooks package exports `useTrust`, `useTrustedProjects`, `useGitStatus`, `useGitDiff`, `useRunDrilldown`, and `useDeleteConfig`, **When** a developer searches for imports of these hooks across all apps, **Then** zero consumer imports are found and these hooks can be safely removed
2. **Given** unused hooks have been removed, **When** both apps are built and tested, **Then** all builds succeed and all tests pass without modification
3. **Given** unused query factory re-exports (`reviewQueries`, `serverQueries`, `trustQueries`, `gitQueries`) are only consumed internally by the hooks package, **When** they are removed from the public barrel export, **Then** no external consumer is affected
4. **Given** all backend endpoints for the removed hooks remain functional, **When** a future feature needs any of these capabilities, **Then** the hook can be re-created from the existing `BoundApi` method and query factory

---

### User Story 2 - Consolidate Hook Files by Domain (Priority: P1)

A developer navigating the hooks directory encounters 25+ separate files, most containing 3-8 lines of code. This extreme fragmentation makes it difficult to understand related functionality at a glance. Grouping related hooks by domain (config, review, trust, git, server) reduces file count by ~65% while keeping the same public API.

**Why this priority**: The current 1-file-per-hook structure is the primary developer experience pain point. It slows navigation, obscures relationships between related queries and mutations, and creates unnecessary import indirection. Consolidation is a pure organizational improvement with no behavioral change.

**Independent Test**: After consolidation, all existing imports from `@diffgazer/api/hooks` continue to work without changes in consumer code. The public API (exported hook names and signatures) remains identical.

**Acceptance Scenarios**:

1. **Given** config-related hooks are spread across 10 separate files (5 queries + 5 mutations), **When** they are consolidated into a single domain file, **Then** all config hooks remain importable from `@diffgazer/api/hooks` with the same names and signatures
2. **Given** trust-related hooks are spread across 4 files, **When** they are consolidated, **Then** the trust domain is represented by a single file
3. **Given** review-related hooks span 7 files (4 queries + 3 mutations), **When** they are consolidated, **Then** review hooks live in a single file, with the streaming hook (`useReviewStream`) remaining separate due to its complexity
4. **Given** git and server hooks are in 3 files total, **When** they are consolidated, **Then** each domain has one file
5. **Given** all hooks have been consolidated, **When** a developer counts hook files, **Then** the count is reduced from 25+ files to ~6-7 domain files plus the context and streaming files

---

### User Story 3 - Rename Query Factory Files (Priority: P2)

A developer notices that query factory files use a redundant `.queries.ts` suffix (e.g., `queries/config.queries.ts`). Since the files already live inside a `queries/` directory, the suffix stutters ("queries/config queries"). Renaming to plain `.ts` (e.g., `queries/config.ts`) follows the principle that directory structure provides the context.

**Why this priority**: A minor but universally-agreed naming improvement. Low risk, quick to execute, but less impactful than structural changes.

**Independent Test**: After renaming, all internal imports within the hooks package resolve correctly, and the package builds successfully.

**Acceptance Scenarios**:

1. **Given** query factory files are named `config.queries.ts`, `review.queries.ts`, `server.queries.ts`, `trust.queries.ts`, `git.queries.ts`, **When** they are renamed to `config.ts`, `review.ts`, `server.ts`, `trust.ts`, `git.ts`, **Then** all internal imports are updated and the package builds
2. **Given** query factories are renamed, **When** consumer apps are built, **Then** no consumer code changes are needed since consumers import hooks, not query factories directly

---

### User Story 4 - Introduce Loading State Helper Pattern (Priority: P3)

A developer building new screens in either the CLI or web app must write the same loading/error/empty guard pattern in every component that uses a query hook. This repetitive boilerplate is error-prone (inconsistent error messages, forgotten empty states) and adds visual noise to components. A standardized helper reduces this to a single declarative call.

**Why this priority**: Valuable but additive -- it improves future development ergonomics without fixing a current bug. The existing pattern works, it's just verbose. This should be done after the structural cleanup (P1/P2) to avoid changing code twice.

**Independent Test**: A new helper can be used in at least one CLI screen and one web page to replace the manual loading/error/empty guards, producing identical user-visible behavior with less code.

**Acceptance Scenarios**:

1. **Given** a component uses a query hook and manually checks loading, error, and empty data states, **When** the developer uses the loading state helper instead, **Then** the component renders the same loading, error, empty, and success states with fewer lines of code
2. **Given** the helper is used in a CLI (Ink) component, **When** the component renders, **Then** loading/error states display correctly using terminal primitives
3. **Given** the helper is used in a web component, **When** the component renders, **Then** loading/error states display correctly using browser rendering
4. **Given** a screen uses multiple queries, **When** the helper is applied to each, **Then** each query's state is handled independently without interference

---

### Edge Cases

- What happens when a hook that is currently unused gets removed but a feature branch in progress depends on it? The removal should be documented so in-flight work can adapt. If a removed hook is needed later, it can be re-created from the existing `BoundApi` method and query factory (backend endpoints are preserved).
- What happens when consolidating hooks changes the import path of internal modules that IDE tooling references? Only the barrel export surface matters -- internal file paths are not part of the public API.
- What happens when the loading state helper is used with a query that has custom state derivation (e.g., `useServerStatus` derives a discriminated union)? The helper should be optional -- hooks with custom state logic continue to work as-is.
- What happens if the trust or git query factories (currently unused in hooks) are needed by future hooks? The factories remain in the `queries/` directory -- only the unused *hook wrappers* and *public re-exports* are removed.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST remove all 6 hooks confirmed unused by both CLI and web apps (`useTrust`, `useTrustedProjects`, `useGitStatus`, `useGitDiff`, `useRunDrilldown`, `useDeleteConfig`) from the shared hooks package while keeping all corresponding backend endpoints intact
- **FR-002**: System MUST consolidate hook files by domain, reducing the file count from 25+ to approximately 6-8 files
- **FR-003**: System MUST preserve all existing public API exports -- every hook name and type signature that is currently used by consumers MUST remain importable from the same package path
- **FR-004**: System MUST rename query factory files to remove the redundant `.queries` suffix
- **FR-005**: System MUST update all internal imports within the hooks package to reflect file renames and consolidation
- **FR-006**: System MUST provide a reusable loading state pattern that works in both browser and terminal rendering environments
- **FR-007**: System MUST NOT introduce any new external dependencies
- **FR-008**: System MUST NOT change the behavior of any hook -- inputs, outputs, cache invalidation targets, and query keys MUST remain identical
- **FR-009**: System MUST remove unused query factory re-exports from the public barrel (keep only `configQueries` which is directly consumed by the web app's ConfigProvider)
- **FR-010**: System MUST keep the streaming hook in its own file due to its substantial complexity and different architectural pattern
- **FR-011**: System MUST NOT modify or remove any backend API endpoints -- all server routes remain intact for future feature development

### Key Entities

- **Query Hook**: A function that fetches data from the API and returns loading/error/data state, with automatic caching and deduplication
- **Mutation Hook**: A function that performs write operations against the API and invalidates related cached data on success
- **Query Factory**: A configuration object that defines cache keys, fetch functions, and staleness policies for a specific data resource
- **Domain Group**: A logical grouping of related hooks by business domain (config, review, trust, git, server)
- **Loading State Helper**: A utility that maps query result state to platform-appropriate rendering (loading, error, empty, success)

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Hook file count is reduced from 25+ files to 8 or fewer (excluding barrel exports and context)
- **SC-002**: Zero unused hooks remain in the public API surface
- **SC-003**: Both CLI and web apps build and pass all existing tests without any consumer code changes to hook imports
- **SC-004**: No query factory file contains a redundant `.queries` suffix in its filename
- **SC-005**: At least one CLI screen and one web page demonstrate the loading state helper, reducing per-component loading/error guard boilerplate by at least 50%
- **SC-006**: The total line count of the hooks package is reduced compared to the current state
- **SC-007**: Zero new external dependencies are introduced
- **SC-008**: All backend API endpoints for removed hooks remain functional and unchanged

## Assumptions

- The 6 hooks identified as unused were created speculatively (one per BoundApi method) and are genuinely dead code, not planned for imminent use
- The `configQueries` factory export is intentionally used directly by the web app's ConfigProvider and must remain in the public API
- Ink 6 supports React Suspense boundaries sufficiently for the loading state helper to use Suspense if desired, but a non-Suspense fallback pattern is acceptable
- The consolidation preserves the current domain boundaries (config, review, trust, git, server) without merging unrelated domains
- Backend endpoints are preserved because features like drilldown (fully implemented + tested) may get frontend triggers in a future spec
