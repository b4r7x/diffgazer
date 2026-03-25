# Data Model: Shared API Hooks Consolidation

**Feature**: 008-hooks-consolidation
**Date**: 2026-03-25

## Entities

### Hook File (Before → After)

The primary transformation is file-level: many single-hook files → fewer domain-grouped files.

#### Before (Current State)

| File | Hooks | Type | Domain | Status |
|------|-------|------|--------|--------|
| `use-settings.ts` | `useSettings` | query | config | Keep |
| `use-init.ts` | `useInit` | query | config | Keep |
| `use-config-check.ts` | `useConfigCheck` | query | config | Keep |
| `use-provider-status.ts` | `useProviderStatus` | query | config | Keep |
| `use-openrouter-models.ts` | `useOpenRouterModels` | query | config | Keep |
| `use-save-settings.ts` | `useSaveSettings` | mutation | config | Keep |
| `use-save-config.ts` | `useSaveConfig` | mutation | config | Keep |
| `use-activate-provider.ts` | `useActivateProvider` | mutation | config | Keep |
| `use-delete-provider-credentials.ts` | `useDeleteProviderCredentials` | mutation | config | Keep |
| `use-delete-config.ts` | `useDeleteConfig` | mutation | config | **Remove** |
| `use-reviews.ts` | `useReviews` | query | review | Keep |
| `use-review.ts` | `useReview` | query | review | Keep |
| `use-active-review-session.ts` | `useActiveReviewSession` | query | review | Keep |
| `use-review-context.ts` | `useReviewContext` | query | review | Keep |
| `use-delete-review.ts` | `useDeleteReview` | mutation | review | Keep |
| `use-refresh-review-context.ts` | `useRefreshReviewContext` | mutation | review | Keep |
| `use-run-drilldown.ts` | `useRunDrilldown` | mutation | review | **Remove** |
| `use-review-stream.ts` | `useReviewStream` | streaming | review | Keep (own file) |
| `use-server-status.ts` | `useServerStatus` | query | server | Keep |
| `use-shutdown.ts` | `useShutdown` | mutation | server | Keep |
| `use-trust.ts` | `useTrust` | query | trust | **Remove** |
| `use-trusted-projects.ts` | `useTrustedProjects` | query | trust | **Remove** |
| `use-save-trust.ts` | `useSaveTrust` | mutation | trust | Keep |
| `use-delete-trust.ts` | `useDeleteTrust` | mutation | trust | Keep |
| `use-git-status.ts` | `useGitStatus` | query | git | **Remove** |
| `use-git-diff.ts` | `useGitDiff` | query | git | **Remove** |
| `context.ts` | `ApiProvider`, `useApi` | context | - | Keep (own file) |

#### After (Target State)

| File | Contains | Hook Count |
|------|----------|------------|
| `context.ts` | `ApiProvider`, `useApi` | 2 |
| `config.ts` | `useSettings`, `useInit`, `useConfigCheck`, `useProviderStatus`, `useOpenRouterModels`, `useSaveSettings`, `useSaveConfig`, `useActivateProvider`, `useDeleteProviderCredentials` | 9 |
| `review.ts` | `useReviews`, `useReview`, `useActiveReviewSession`, `useReviewContext`, `useDeleteReview`, `useRefreshReviewContext` | 6 |
| `trust.ts` | `useSaveTrust`, `useDeleteTrust` | 2 |
| `server.ts` | `useServerStatus`, `useShutdown` | 2 |
| `use-review-stream.ts` | `useReviewStream` | 1 |
| `match-query-state.ts` | `matchQueryState` | 1 |
| `index.ts` | Barrel re-exports | 0 |

**Total**: 8 files (down from 28), 23 hooks (down from 27, removed 6, added 1 utility)

### Query Factory Files (Rename)

| Before | After |
|--------|-------|
| `queries/config.queries.ts` | `queries/config.ts` |
| `queries/review.queries.ts` | `queries/review.ts` |
| `queries/server.queries.ts` | `queries/server.ts` |
| `queries/trust.queries.ts` | `queries/trust.ts` |
| `queries/git.queries.ts` | `queries/git.ts` |
| `queries/index.ts` | **Remove** (barrel unnecessary, direct imports used) |

### Public API Surface (index.ts exports)

#### Removed exports

```typescript
// Query hooks (unused)
useTrust, useTrustedProjects, useGitStatus, useGitDiff
// Mutation hooks (unused)
useRunDrilldown, useDeleteConfig
// Query factory re-exports (unused externally)
reviewQueries, serverQueries, trustQueries, gitQueries
```

#### Preserved exports (unchanged signatures)

```typescript
// Context
ApiProvider, useApi

// Config domain
useSettings, useInit, useConfigCheck, useProviderStatus, useOpenRouterModels
useSaveSettings, useSaveConfig, useActivateProvider, useDeleteProviderCredentials

// Review domain
useReviews, useReview, useActiveReviewSession, useReviewContext
useDeleteReview, useRefreshReviewContext

// Trust domain
useSaveTrust, useDeleteTrust

// Server domain
useServerStatus (+ ServerState type), useShutdown

// Streaming
useReviewStream (+ ReviewStreamState type, UseReviewStreamOptions type)

// Query factory (only one used externally)
configQueries
```

#### Added exports

```typescript
matchQueryState  // loading state utility
```

### Cache Invalidation Map (Unchanged)

No cache invalidation targets change. All mutation hooks preserve their exact `onSuccess` invalidation logic:

| Mutation | Invalidates |
|----------|-------------|
| `useSaveSettings` | `['config', 'settings']` |
| `useSaveConfig` | `['config']` (all) |
| `useActivateProvider` | `['config', 'providers']` + `['config', 'init']` |
| `useDeleteProviderCredentials` | `['config']` (all) |
| `useSaveTrust` | `['trust']` + `['config', 'init']` |
| `useDeleteTrust` | `['trust']` + `['config', 'init']` |
| `useDeleteReview` | removes `['review', id]`, invalidates `['review']` (all) |
| `useRefreshReviewContext` | `['review', 'context']` |
| `useShutdown` | none |
