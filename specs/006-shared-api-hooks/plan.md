# Implementation Plan: Shared API Hooks & Unified Data Fetching

**Branch**: `006-shared-api-hooks` | **Date**: 2026-03-24 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/006-shared-api-hooks/spec.md`

## Summary

Consolidate duplicated API data-fetching hooks from the web and CLI apps into a shared `@diffgazer/api/hooks` subpath export. Introduce TanStack Query v5 for automatic caching, deduplication, retry, and loading/error state management. Create 14 shared query hooks, 11 shared mutation hooks, and 1 shared streaming hook. Migrate both apps to use the shared hooks, removing ~80% of duplicated API-calling code. Configure TanStack Query for non-browser (Ink) compatibility with `networkMode: 'always'`.

## Technical Context

**Language/Version**: TypeScript 5.x (strict: true), ESM only, `.js` extensions in imports
**Primary Dependencies**: `@tanstack/react-query` v5 (new), React 19, Ink 6 (CLI), Vite 7 (web), `@diffgazer/api`, `@diffgazer/core`, `@diffgazer/schemas`
**Storage**: N/A (hooks are a client-side concern; server storage unchanged)
**Testing**: Vitest, `@testing-library/react`, `@testing-library/react-hooks`
**Target Platform**: Node.js (Ink CLI terminal) + Browser (Vite web app)
**Project Type**: Monorepo shared package (`@diffgazer/api/hooks`) + app migration
**Performance Goals**: Local-only single-user app; no high-performance requirements
**Constraints**: No browser APIs (`window`, `document`, `navigator`) in shared hooks; ESM only; React 19 Compiler (no manual memoization)
**Scale/Scope**: 14 query hooks + 11 mutation hooks + 1 streaming hook + 2 app migrations + ConfigProvider simplification

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Constitution file is not configured (template placeholders only). No gates to check. Proceeding.

**Post-Phase 1 re-check**: No violations. The design adds a single new dependency (`@tanstack/react-query` as peerDependency) and extends an existing package (`@diffgazer/api`) with a new subpath export. No new packages, no new abstractions beyond what TanStack Query provides.

## Project Structure

### Documentation (this feature)

```text
specs/006-shared-api-hooks/
├── plan.md              # This file
├── spec.md              # Feature specification
├── research.md          # Phase 0: research findings
├── data-model.md        # Phase 1: query keys, invalidation map, state models
├── quickstart.md        # Phase 1: setup and usage guide
├── contracts/
│   └── hooks-api.md     # Phase 1: full public API contract
├── checklists/
│   └── requirements.md  # Spec quality checklist
└── tasks.md             # Phase 2 output (created by /speckit.tasks)
```

### Source Code (repository root)

```text
packages/api/
├── src/
│   ├── index.ts              # existing — createApi, BoundApi (unchanged)
│   ├── bound.ts              # existing — BoundApi factory (unchanged)
│   ├── client.ts             # existing — HTTP client (unchanged)
│   ├── types.ts              # existing — response types (unchanged)
│   ├── config.ts             # existing — config domain (unchanged)
│   ├── review.ts             # existing — review domain (unchanged)
│   ├── git.ts                # existing — git domain (unchanged)
│   ├── shutdown.ts           # existing — shutdown domain (unchanged)
│   └── hooks/                # NEW — shared React hooks
│       ├── index.ts          # barrel: re-exports all hooks + ApiProvider + query factories
│       ├── context.ts        # ApiProvider + useApi
│       ├── queries/
│       │   ├── index.ts      # barrel for query factories
│       │   ├── config.queries.ts
│       │   ├── review.queries.ts
│       │   ├── server.queries.ts
│       │   ├── trust.queries.ts
│       │   └── git.queries.ts
│       ├── use-settings.ts
│       ├── use-save-settings.ts
│       ├── use-init.ts
│       ├── use-config-check.ts
│       ├── use-provider-status.ts
│       ├── use-activate-provider.ts
│       ├── use-save-config.ts
│       ├── use-delete-provider-credentials.ts
│       ├── use-openrouter-models.ts
│       ├── use-server-status.ts
│       ├── use-reviews.ts
│       ├── use-review.ts
│       ├── use-active-review-session.ts
│       ├── use-review-context.ts
│       ├── use-refresh-review-context.ts
│       ├── use-delete-review.ts
│       ├── use-run-drilldown.ts
│       ├── use-trust.ts
│       ├── use-save-trust.ts
│       ├── use-delete-trust.ts
│       ├── use-delete-config.ts
│       ├── use-git-status.ts
│       ├── use-git-diff.ts
│       ├── use-shutdown.ts
│       └── use-review-stream.ts  # useReducer-based (NOT TanStack Query)
├── package.json              # MODIFIED — add ./hooks export, peerDeps
└── tsconfig.json             # MODIFIED — include hooks/ in compilation

apps/cli/src/
├── app/
│   └── index.tsx             # MODIFIED — add QueryClientProvider + ApiProvider
├── hooks/
│   ├── use-init.ts           # DELETE (replaced by @diffgazer/api/hooks)
│   ├── use-settings.ts       # DELETE
│   ├── use-server-status.ts  # DELETE
│   └── use-config-guard.ts   # SIMPLIFY — thin wrapper calling shared useConfigCheck + navigation
├── features/review/hooks/
│   ├── use-review-stream.ts  # DELETE (replaced by shared hook)
│   └── use-review-lifecycle.ts # SIMPLIFY — compose shared hooks + CLI navigation
└── lib/
    └── api.ts                # KEEP — creates CLI-specific api singleton

apps/web/src/
├── app/
│   ├── routes/__root.tsx     # MODIFIED — add QueryClientProvider + ApiProvider
│   └── providers/
│       ├── config-provider.tsx # SIMPLIFY — delegate to shared hooks
│       └── theme-provider.tsx  # SIMPLIFY — use useSaveSettings mutation
├── hooks/
│   ├── use-settings.ts       # DELETE (replaced by @diffgazer/api/hooks)
│   ├── use-server-status.ts  # DELETE
│   ├── use-openrouter-models.ts # DELETE
│   └── use-trust.ts          # DELETE
├── features/
│   ├── review/hooks/
│   │   ├── use-review-stream.ts    # DELETE (replaced by shared hook)
│   │   ├── use-review-start.ts     # SIMPLIFY
│   │   ├── use-context-snapshot.ts  # DELETE (replaced by useReviewContext)
│   │   └── use-review-lifecycle.ts  # SIMPLIFY — compose shared hooks + web navigation
│   ├── history/hooks/
│   │   ├── use-reviews.ts          # DELETE
│   │   ├── use-review-detail.ts    # DELETE
│   │   └── use-review-history.ts   # SIMPLIFY
│   ├── settings/hooks/
│   │   └── use-context-management.ts # DELETE (use useReviewContext + useRefreshReviewContext)
│   └── onboarding/hooks/
│       └── use-onboarding.ts       # SIMPLIFY — use shared mutations
└── lib/
    └── api.ts                # KEEP — creates web-specific api singleton
```

**Structure Decision**: Hooks are added to the existing `@diffgazer/api` package under a new `src/hooks/` directory, exposed via `./hooks` subpath export. This keeps API-related concerns cohesive. React and TanStack Query are peerDependencies — only loaded when `@diffgazer/api/hooks` is imported.
