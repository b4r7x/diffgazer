# Research: Shared API Hooks & Unified Data Fetching

**Feature Branch**: `006-shared-api-hooks`
**Date**: 2026-03-24

## 1. TanStack Query v5 + Ink 6 Compatibility

**Decision**: TanStack Query v5 is compatible with Ink 6 (React for terminal).

**Rationale**: TanStack Query's React binding uses only React core hooks (`useSyncExternalStore`, `useRef`, `useCallback`, `useEffect`). It does not depend on any DOM APIs at the module level. Browser-specific behaviors (window focus, online detection) are opt-in listeners that can be disabled via configuration. React Native compatibility (another non-DOM renderer) proves this works.

**Configuration for Ink**:
```typescript
new QueryClient({
  defaultOptions: {
    queries: {
      networkMode: 'always',        // bypasses navigator.onLine check
      refetchOnWindowFocus: false,   // no window.addEventListener('visibilitychange')
      refetchOnReconnect: false,     // no navigator.onLine listener
      retry: 1,
      staleTime: 30_000,
    },
    mutations: { networkMode: 'always' },
  },
})
```

**Alternatives considered**: SWR (4KB vs 13KB, but weaker mutations/cache invalidation, no explicit `networkMode: 'always'`). Custom wrapper (zero deps but requires manual caching, dedup, retry).

---

## 2. Query Key Factory Pattern (queryOptions)

**Decision**: Use TanStack Query v5's `queryOptions()` helper to create typed query factories organized by domain.

**Rationale**: `queryOptions()` co-locates `queryKey` and `queryFn` with full type inference. Hierarchical keys enable targeted invalidation (`['config']` invalidates all config queries). This is the official v5 recommended pattern.

**Pattern**:
```typescript
export const configQueries = {
  all: () => ['config'] as const,
  settings: (api: BoundApi) => queryOptions({
    queryKey: [...configQueries.all(), 'settings'] as const,
    queryFn: () => api.getSettings(),
    staleTime: 30_000,
  }),
  init: (api: BoundApi) => queryOptions({
    queryKey: [...configQueries.all(), 'init'] as const,
    queryFn: () => api.loadInit(),
  }),
}
```

**Alternatives considered**: Simple string arrays without factories (no type safety, key duplication risk). Third-party `@lukemorales/query-key-factory` (unnecessary — v5's `queryOptions` covers this natively).

---

## 3. Shared Hook Pattern

**Decision**: Thin wrapper hooks that spread `queryOptions` into `useQuery`, receiving `api` from `useApi()` context.

**Rationale**: Minimal boilerplate per hook (~5 lines). Callers can override options via spread. Returns standard `UseQueryResult` — no custom wrapper types.

**Pattern**:
```typescript
export function useSettings(options?: Partial<UseQueryOptions<SettingsConfig>>) {
  const api = useApi()
  return useQuery({ ...configQueries.settings(api), ...options })
}
```

---

## 4. Mutation with Cache Invalidation Pattern

**Decision**: `useMutation` hooks with `onSuccess` that `await`s `queryClient.invalidateQueries()`.

**Rationale**: Awaiting invalidation keeps `isPending: true` until the cache is fresh, preventing stale UI. Each mutation documents which queries it invalidates.

**Pattern**:
```typescript
export function useSaveSettings() {
  const api = useApi()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (s: Partial<SettingsConfig>) => api.saveSettings(s),
    onSuccess: () => qc.invalidateQueries({ queryKey: configQueries.settings(api).queryKey }),
  })
}
```

---

## 5. API Client Injection via React Context

**Decision**: `ApiProvider` React context exported from `@diffgazer/api/hooks`.

**Rationale**: Both apps create `api` instances with different configs (`projectRoot` for CLI, browser origin for web). Context injection is the idiomatic React pattern — no global singletons, works with testing (wrap in provider with mock api).

**Pattern**:
```typescript
const ApiContext = createContext<BoundApi | null>(null)
export const ApiProvider = ApiContext.Provider
export function useApi(): BoundApi {
  const api = useContext(ApiContext)
  if (!api) throw new Error('useApi must be used within an <ApiProvider>')
  return api
}
```

---

## 6. Package Placement

**Decision**: Hooks go in `@diffgazer/api` package under a new `./hooks` subpath export.

**Rationale**: The API package already owns the transport layer and types. Adding hooks here keeps the "API connection" concern cohesive. React and TanStack Query become `peerDependencies` — only consumed when `@diffgazer/api/hooks` is imported. The existing `@diffgazer/api` (root) export remains pure transport, no React.

**Structure**:
```
packages/api/src/
  hooks/
    index.ts              # barrel: re-exports all hooks + ApiProvider
    context.ts            # ApiProvider + useApi
    queries/
      config.queries.ts   # configQueries factory
      review.queries.ts   # reviewQueries factory
      git.queries.ts      # gitQueries factory
      index.ts
    use-settings.ts
    use-save-settings.ts
    use-init.ts
    use-config-check.ts
    use-server-status.ts
    use-providers.ts
    use-activate-provider.ts
    use-save-config.ts
    use-delete-provider-credentials.ts
    use-openrouter-models.ts
    use-reviews.ts
    use-review.ts
    use-delete-review.ts
    use-active-review-session.ts
    use-review-context.ts
    use-refresh-review-context.ts
    use-trust.ts
    use-save-trust.ts
    use-delete-trust.ts
    use-shutdown.ts
    use-review-stream.ts  # useReducer-based, NOT TanStack Query
```

New subpath export in `package.json`:
```json
"./hooks": { "types": "./dist/hooks/index.d.ts", "import": "./dist/hooks/index.js" }
```

---

## 7. Complete Hook Inventory (Migration Scope)

### Shared Query Hooks (14 — from useQuery)

| Hook | BoundApi Method | Query Key | staleTime |
|------|----------------|-----------|-----------|
| `useSettings` | `getSettings` | `['config', 'settings']` | 30s |
| `useInit` | `loadInit` | `['config', 'init']` | 5min |
| `useConfigCheck` | `checkConfig` | `['config', 'check']` | 30s |
| `useProviderStatus` | `getProviderStatus` | `['config', 'providers']` | 30s |
| `useOpenRouterModels` | `getOpenRouterModels` | `['config', 'openrouter-models']` | 5min |
| `useServerStatus` | `request("GET", "/api/health")` | `['server', 'health']` | refetchInterval: 30s |
| `useReviews` | `getReviews` | `['reviews', projectPath?]` | 0 (always fresh) |
| `useReview` | `getReview` | `['review', id]` | 60s |
| `useActiveReviewSession` | `getActiveReviewSession` | `['review', 'active-session', mode?]` | 0 |
| `useReviewContext` | `getReviewContext` | `['review', 'context']` | 60s |
| `useGitStatus` | `getGitStatus` | `['git', 'status', path?]` | 0 |
| `useGitDiff` | `getGitDiff` | `['git', 'diff', mode?, path?]` | 0 |
| `useTrust` | `getTrust` | `['trust', projectId]` | 60s |
| `useTrustedProjects` | `listTrustedProjects` | `['trust', 'list']` | 60s |

### Shared Mutation Hooks (13 — from useMutation)

| Hook | BoundApi Method | Invalidates |
|------|----------------|-------------|
| `useSaveSettings` | `saveSettings` | `['config', 'settings']` |
| `useSaveConfig` | `saveConfig` | `['config']` (all) |
| `useActivateProvider` | `activateProvider` | `['config', 'providers']`, `['config', 'init']` |
| `useDeleteProviderCredentials` | `deleteProviderCredentials` | `['config']` (all) |
| `useDeleteConfig` | `deleteConfig` | `['config']` (all) |
| `useSaveTrust` | `saveTrust` | `['trust']`, `['config', 'init']` |
| `useDeleteTrust` | `deleteTrust` | `['trust']`, `['config', 'init']` |
| `useDeleteReview` | `deleteReview` | `['reviews']`, remove `['review', id]` |
| `useRefreshReviewContext` | `refreshReviewContext` | `['review', 'context']` |
| `useRunDrilldown` | `runReviewDrilldown` | `['review', reviewId]` |
| `useShutdown` | `shutdown` | n/a |

### Shared Streaming Hook (1 — useReducer-based, NOT TanStack Query)

| Hook | BoundApi Method | Notes |
|------|----------------|-------|
| `useReviewStream` | `streamReviewWithEvents`, `resumeReviewStream` | Extends `reviewReducer` from `@diffgazer/core/review`. Platform-specific batching via callback option. |

### Inline API Calls to Extract (14 component files in CLI, 3 in web)

These direct `api.*` calls in components should be replaced with shared hooks during migration.

---

## 8. ConfigProvider Simplification

**Decision**: Simplify to thin wrapper composing shared TanStack Query hooks.

**Before** (ConfigProvider owns):
- Module-level TTL cache + useSyncExternalStore
- Split ConfigDataContext + ConfigActionsContext
- 5 direct api.* calls (loadInit, getProviderStatus, activateProvider, saveConfig, deleteProviderCredentials)
- Manual isSaving/isLoading/error state

**After** (ConfigProvider delegates):
- Uses `useInit()`, `useProviderStatus()` shared hooks for data
- Uses `useActivateProvider()`, `useSaveConfig()`, `useDeleteProviderCredentials()` shared mutations
- Derives `isConfigured`, `setupStatus`, `trust` from query data
- No manual caching — TanStack Query handles it
- Split contexts remain for render optimization (data vs actions)

---

## 9. Web useSettings Cache Removal

**Decision**: Remove module-level `useSyncExternalStore` cache, TTL, and subscriber pattern from web's `useSettings`. Replace with `useQuery` from shared hooks.

**Rationale**: TanStack Query provides all the same functionality (caching, stale-while-revalidate, deduplication, manual invalidation) with zero custom code. The exported `invalidateSettingsCache()` and `refreshSettingsCache()` functions are replaced by `queryClient.invalidateQueries({ queryKey: ['config', 'settings'] })`.
