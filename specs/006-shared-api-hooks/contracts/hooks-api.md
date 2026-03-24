# Contract: @diffgazer/api/hooks Public API

**Feature Branch**: `006-shared-api-hooks`
**Date**: 2026-03-24

## Subpath Export

```
@diffgazer/api/hooks
```

## Context Provider

```typescript
// ApiProvider — wraps app tree, provides BoundApi instance
export const ApiProvider: React.Provider<BoundApi>

// useApi — reads BoundApi from context, throws if missing
export function useApi(): BoundApi
```

## Query Factories

```typescript
// Hierarchical query key factories using queryOptions()
export const configQueries: {
  all: () => readonly ['config']
  settings: (api: BoundApi) => UseQueryOptions<SettingsConfig>
  init: (api: BoundApi) => UseQueryOptions<InitResponse>
  check: (api: BoundApi) => UseQueryOptions<ConfigCheckResponse>
  providers: (api: BoundApi) => UseQueryOptions<ProviderStatus[]>
  openRouterModels: (api: BoundApi) => UseQueryOptions<OpenRouterModelsResponse>
}

export const reviewQueries: {
  all: () => readonly ['review']
  list: (api: BoundApi, projectPath?: string) => UseQueryOptions<ReviewsResponse>
  detail: (api: BoundApi, id: string) => UseQueryOptions<ReviewResponse>
  activeSession: (api: BoundApi, mode?: ReviewMode) => UseQueryOptions<ActiveReviewSessionResponse>
  context: (api: BoundApi) => UseQueryOptions<ReviewContextResponse>
}

export const serverQueries: {
  health: (api: BoundApi) => UseQueryOptions<void>
}

export const trustQueries: {
  all: () => readonly ['trust']
  single: (api: BoundApi, projectId: string) => UseQueryOptions<TrustResponse>
  list: (api: BoundApi) => UseQueryOptions<TrustListResponse>
}

export const gitQueries: {
  status: (api: BoundApi, path?: string) => UseQueryOptions<GitStatus>
  diff: (api: BoundApi, mode?: ReviewMode, path?: string) => UseQueryOptions<GitDiffResponse>
}
```

## Query Hooks

Each returns `UseQueryResult<T, Error>` from TanStack Query.

```typescript
export function useSettings(): UseQueryResult<SettingsConfig>
export function useInit(): UseQueryResult<InitResponse>
export function useConfigCheck(): UseQueryResult<ConfigCheckResponse>
export function useProviderStatus(): UseQueryResult<ProviderStatus[]>
export function useOpenRouterModels(options?: { enabled?: boolean }): UseQueryResult<OpenRouterModelsResponse>
export function useServerStatus(): UseQueryResult<void>  // refetchInterval: 30s
export function useReviews(projectPath?: string): UseQueryResult<ReviewsResponse>
export function useReview(id: string): UseQueryResult<ReviewResponse>
export function useActiveReviewSession(mode?: ReviewMode): UseQueryResult<ActiveReviewSessionResponse>
export function useReviewContext(): UseQueryResult<ReviewContextResponse>
export function useTrust(projectId: string): UseQueryResult<TrustResponse>
export function useTrustedProjects(): UseQueryResult<TrustListResponse>
export function useGitStatus(path?: string): UseQueryResult<GitStatus>
export function useGitDiff(mode?: ReviewMode, path?: string): UseQueryResult<GitDiffResponse>
```

## Mutation Hooks

Each returns `UseMutationResult<TData, Error, TVariables>` from TanStack Query.

```typescript
export function useSaveSettings(): UseMutationResult<void, Error, Partial<SettingsConfig>>
export function useSaveConfig(): UseMutationResult<void, Error, SaveConfigRequest>
export function useActivateProvider(): UseMutationResult<ActivateProviderResponse, Error, { providerId: string; model?: string }>
export function useDeleteProviderCredentials(): UseMutationResult<DeleteProviderCredentialsResponse, Error, string>
export function useDeleteConfig(): UseMutationResult<DeleteConfigResponse, Error, void>
export function useSaveTrust(): UseMutationResult<TrustResponse, Error, TrustConfig>
export function useDeleteTrust(): UseMutationResult<{ removed: boolean }, Error, string>
export function useDeleteReview(): UseMutationResult<{ existed: boolean }, Error, string>
export function useRefreshReviewContext(): UseMutationResult<ReviewContextResponse, Error, { force?: boolean }>
export function useRunDrilldown(): UseMutationResult<DrilldownResponse, Error, { reviewId: string; issueId: string }>
export function useShutdown(): UseMutationResult<ShutdownResponse, Error, void>
```

## Streaming Hook (useReducer-based, NOT TanStack Query)

```typescript
export interface UseReviewStreamOptions {
  /** Optional event batching strategy. Web provides rAF batching, CLI provides sync dispatch. */
  batchEvents?: (dispatch: React.Dispatch<ReviewAction>, events: FullReviewStreamEvent[]) => void
}

export function useReviewStream(options?: UseReviewStreamOptions): {
  state: ReviewStreamState
  start: (mode: ReviewMode, lenses?: LensId[]) => Promise<void>
  stop: () => void
  abort: () => void
  resume: (reviewId: string) => Promise<Result<void, StreamReviewError>>
}
```

## Peer Dependencies

```json
{
  "@tanstack/react-query": "^5.0.0",
  "react": "^18.0.0 || ^19.0.0"
}
```
