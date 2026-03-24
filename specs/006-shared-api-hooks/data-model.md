# Data Model: Shared API Hooks

**Feature Branch**: `006-shared-api-hooks`
**Date**: 2026-03-24

## Entities

### ApiProvider Context

The React context that holds the platform-specific `BoundApi` instance.

| Field | Type | Description |
|-------|------|-------------|
| value | `BoundApi` | The bound API client instance from `createApi()` |

**Lifecycle**: Created once at app startup, never changes during the session.

### Query Key Hierarchy

All query keys follow a hierarchical domain-based structure for targeted invalidation.

```
['config']                           # all config queries
  ['config', 'settings']             # settings
  ['config', 'init']                 # init/setup data
  ['config', 'check']               # config check
  ['config', 'providers']            # provider status
  ['config', 'openrouter-models']    # openrouter models

['reviews']                          # review list
  ['reviews', projectPath?]          # filtered by project

['review', id]                       # single review
['review', 'active-session', mode?]  # active session
['review', 'context']               # review context
['review', 'stream']                # streaming (mutation key)

['server', 'health']                # health check (polling)

['trust', projectId]                # single trust entry
['trust', 'list']                   # all trusted projects

['git', 'status', path?]            # git status
['git', 'diff', mode?, path?]       # git diff
```

### Invalidation Map

Mutations and which queries they invalidate on success.

| Mutation | Invalidates |
|----------|-------------|
| saveSettings | `['config', 'settings']` |
| saveConfig | `['config']` (entire domain) |
| activateProvider | `['config', 'providers']`, `['config', 'init']` |
| deleteProviderCredentials | `['config']` (entire domain) |
| deleteConfig | `['config']` (entire domain) |
| saveTrust | `['trust']`, `['config', 'init']` |
| deleteTrust | `['trust']`, `['config', 'init']` |
| deleteReview | `['reviews']`, remove `['review', id]` |
| refreshReviewContext | `['review', 'context']` |
| runReviewDrilldown | `['review', reviewId]` |
| shutdown | n/a |

### QueryClient Configurations

Two platform-specific configurations.

**CLI (Ink / Node.js)**:
- `networkMode: 'always'`
- `refetchOnWindowFocus: false`
- `refetchOnReconnect: false`
- `retry: 1`
- `staleTime: 30_000`

**Web (Browser)**:
- `networkMode: 'online'` (default)
- `refetchOnWindowFocus: true` (default)
- `refetchOnReconnect: true` (default)
- `retry: 2`
- `staleTime: 60_000`

### Review Stream State (useReducer — NOT TanStack Query)

The streaming hook uses a shared reducer from `@diffgazer/core/review`, extended per-platform.

| Field | Type | Description |
|-------|------|-------------|
| reviewId | `string \| null` | Active review ID (set from `review_started` event) |
| status | `'idle' \| 'streaming' \| 'complete' \| 'error'` | Stream lifecycle |
| issues | `ReviewIssue[]` | Accumulated issues from agent events |
| steps | `StepState[]` | Step progress tracking |
| agents | `AgentState[]` | Agent progress tracking |
| events | `FullReviewStreamEvent[]` | Raw event log |
| error | `string \| null` | Error message if failed |

**State transitions**: `idle` → (start) → `streaming` → (complete/error) → `complete` or `error`
