# Data Model: CLI Ink Web Parity

**Branch**: `012-cli-ink-web-parity` | **Date**: 2026-03-25

## Overview

This feature does not introduce new data entities. It consolidates and audits existing shared data contracts between the CLI and web apps. The data model below documents the existing shared contracts that both apps depend on.

## Shared Data Contracts (already exist, no changes needed)

### Query State Flow

```
BoundApi (transport) → useQuery/useMutation hooks → UseQueryResult<T> → matchQueryState → UI
```

Both apps consume `UseQueryResult<T>` which provides: `{ data, isLoading, error, refetch }`.

### Review Streaming State Machine

```
START → EVENT* → (COMPLETE | ERROR) → RESET?

ReviewState {
  steps: StepState[]         # Pipeline steps
  agents: AgentState[]       # Individual AI agents
  issues: ReviewIssue[]      # Found issues (accumulated)
  events: ReviewEvent[]      # Full event log
  fileProgress: FileProgress # { total, current, currentFile, completed[] }
  isStreaming: boolean
  error: string | null
  startedAt: Date | null
}
```

### Navigation State (CLI-specific, not shared)

```
Route = discriminated union (13 screens)
NavigationState = { route: Route, stack: Route[] }
Transitions: navigate(route) pushes stack; goBack() pops or follows deterministic mapping
```

## Entities to Extract/Consolidate

### NavigationConfig (currently duplicated)

Currently in both `apps/cli/src/config/navigation.ts` and `apps/web/src/config/navigation.ts`:

```
MenuAction = "review" | "history" | "settings" | "quit" | "help"
SettingsAction = "theme" | "providers" | "storage" | ...
NavItem = { id, label, description, group?, shortcut? }
MENU_ITEMS: NavItem[]
SETTINGS_MENU_ITEMS: NavItem[]
```

**Target**: Extract to `@diffgazer/core` or `@diffgazer/schemas/ui`

### Shortcut (currently triplicated)

```
Shortcut = { key: string; label: string; disabled?: boolean }
```

Canonical in `@diffgazer/schemas/ui`. CLI has 2 local copies that should be removed.

### DiagnosticsData (currently duplicated logic)

Status derivation shared between both diagnostics pages:

```
ContextStatus = "loading" | "ready" | "missing" | "error"
DiagnosticsState = {
  serverState: ServerState
  contextStatus: ContextStatus
  contextGeneratedAt: Date | null
  setupStatus: "complete" | "incomplete"
  isRefreshing: boolean
}
```

**Target**: Extract `useDiagnosticsData()` shared hook

## No Schema Changes Required

All Zod schemas in `@diffgazer/schemas/*` remain unchanged. No new API endpoints are needed. The backend server requires zero modifications.
