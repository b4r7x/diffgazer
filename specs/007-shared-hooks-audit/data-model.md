# Data Model: Shared API Hooks

**Date**: 2026-03-25

This feature is a refactoring audit — no new entities are introduced. This document describes the existing data model being corrected.

## Entities

### Query Key Factory

An object that defines hierarchical query keys for a domain. Each factory has:

- **`all()`**: Root key prefix. All other keys in the factory MUST be nested under this prefix for hierarchical invalidation to work.
- **Domain-specific methods**: Return `queryOptions()` objects co-locating key + fetch function + config.

**Current state** (with issues marked):

| Factory | Root key (`all()`) | Sub-keys | Issue |
| ------- | ------------------ | -------- | ----- |
| `configQueries` | `["config"]` | `settings`, `init`, `check`, `providers`, `openRouterModels` | None |
| `reviewQueries` | `["review"]` | `list`, `detail`, `activeSession`, `context` | `list` uses `["reviews"]` instead of `["review", "list"]` |
| `trustQueries` | `["trust"]` | `single`, `list` | None |
| `serverQueries` | **Missing** | `health` | No `all()` method |
| `gitQueries` | **Missing** | `status`, `diff` | No `all()` method |

**Target state** (after fixes):

| Factory | Root key (`all()`) | Sub-keys |
| ------- | ------------------ | -------- |
| `configQueries` | `["config"]` | `settings`, `init`, `check`, `providers`, `openRouterModels` |
| `reviewQueries` | `["review"]` | `list`, `detail`, `activeSession`, `context` |
| `trustQueries` | `["trust"]` | `single`, `list` |
| `serverQueries` | `["server"]` | `health` |
| `gitQueries` | `["git"]` | `status`, `diff` |

### ServerState (discriminated union)

Represents the health check result mapped to a UI-consumable state. Currently duplicated in 3 locations — will be consolidated to shared package.

**States**:
- `"checking"` — query is loading, no result yet
- `"connected"` — query succeeded, server is reachable
- `"error"` — query failed, includes error details and retry function

**Relationships**:
- Derived from: `useServerStatus` query hook (TanStack Query `UseQueryResult`)
- Consumed by: `HealthGate` (both apps), `DiagnosticsScreen` (CLI)

### resolveDefaultLenses (pure function)

Validates and resolves default lens configuration for review sessions.

**Input**: `defaultLenses` array from user settings
**Output**: Array of validated `LensId` values, or `FALLBACK_LENSES` if input is empty/invalid
**Validation**: Each element parsed through `LensIdSchema.safeParse()`

**Relationships**:
- Depends on: `LensIdSchema` from `@diffgazer/schemas`
- Consumed by: `useReviewLifecycle` (CLI), `useReviewSettings` (web)
- Currently duplicated in both consumer locations

### ReviewStream API Surface

The streaming hook exposes control functions for the SSE review stream.

**Current API** (inconsistent):

| Function | Return type | Error reporting |
| -------- | ----------- | --------------- |
| `start` | `Promise<void>` | State only (dispatch) |
| `resume` | `Promise<Result<void, StreamReviewError>>` | State + return value |
| `stop` | `void` | N/A (user-initiated) |
| `abort` | `void` | N/A (user-initiated) |

**Target API** (consistent):

| Function | Return type | Error reporting |
| -------- | ----------- | --------------- |
| `start` | `Promise<void>` | State only (dispatch) |
| `resume` | `Promise<void>` | State only (dispatch) |
| `stop` | `void` | N/A |
| `abort` | `void` | N/A |

## Invalidation Map (corrected)

After fixing the review list key hierarchy:

| Mutation | Invalidates |
| -------- | ----------- |
| `useSaveSettings` | `["config", "settings"]` |
| `useSaveConfig` | `["config"]` (all) |
| `useActivateProvider` | `["config", "providers"]` + `["config", "init"]` |
| `useDeleteProviderCredentials` | `["config"]` (all) |
| `useDeleteConfig` | `["config"]` (all) |
| `useSaveTrust` | `["trust"]` (all) + `["config", "init"]` |
| `useDeleteTrust` | `["trust"]` (all) + `["config", "init"]` |
| `useDeleteReview` | Removes `["review", id]`, invalidates `["review"]` (all, via factory) |
| `useRefreshReviewContext` | `["review", "context"]` |
| `useRunDrilldown` | `["review", reviewId]` |
| `useShutdown` | None |
