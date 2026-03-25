# Implementation Plan: CLI Ink Web Parity

**Branch**: `012-cli-ink-web-parity` | **Date**: 2026-03-25 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/012-cli-ink-web-parity/spec.md`

## Summary

Both CLI (Ink 6) and web (React 19 + Vite) apps are already fully implemented with matching screens and shared API hooks. This plan covers consolidation of duplicated code, quality audit resolution across the full codebase (CLI, web, shared packages), standardization of loading/error/empty state patterns, SRP decomposition of complex hooks, YAGNI cleanup of dead exports, and responsive layout improvements in the CLI. No new screens or API endpoints are needed.

## Technical Context

**Language/Version**: TypeScript 5.x (strict: true), ESM only, .js extensions in imports
**Primary Dependencies**: React 19, Ink 6 (CLI), TanStack Query v5, Vite 7 (web), Zod 4, commander, picocolors
**Storage**: File-based (JSON config, review data), OS keyring for secrets
**Testing**: vitest (unit), @testing-library/react (web components)
**Target Platform**: macOS/Linux terminal (CLI), modern browsers (web)
**Project Type**: Monorepo with 2 apps (CLI + web) + 5 shared packages
**Performance Goals**: N/A (local tool, single user)
**Constraints**: CLI must work in terminals >= 80 columns; TanStack Query `networkMode: 'always'` for Node.js
**Scale/Scope**: ~14 screens per app, ~22 shared hooks, ~30 BoundApi methods, ~50 files to modify

## Constitution Check

*GATE: Constitution is an unfilled template — no gates to enforce. Proceeding.*

**Post-Phase 1 re-check**: No violations. All changes are consolidation/cleanup within existing architecture boundaries.

## Project Structure

### Documentation (this feature)

```text
specs/012-cli-ink-web-parity/
├── plan.md              # This file
├── spec.md              # Feature specification
├── research.md          # Phase 0: codebase research findings
├── data-model.md        # Phase 1: data model (no new entities)
├── quickstart.md        # Phase 1: quickstart guide
├── contracts/           # Phase 1: shared hooks + quality audit contracts
│   ├── shared-hooks-contract.md
│   └── quality-audit-contract.md
├── checklists/
│   └── requirements.md  # Spec quality checklist
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

### Source Code (repository root)

```text
apps/
├── cli/src/                         # CLI app (Ink 6)
│   ├── app/
│   │   ├── screens/                 # 14 screen components
│   │   ├── providers/               # 3 providers (keyboard, footer, server)
│   │   ├── router.tsx               # Component map routing
│   │   └── navigation-context.tsx   # In-memory navigation state
│   ├── features/                    # 6 feature domains
│   │   ├── home/components/         # 4 components
│   │   ├── review/
│   │   │   ├── components/          # 13 components
│   │   │   └── hooks/               # 2 hooks (lifecycle, keyboard)
│   │   ├── onboarding/components/   # 8 components (wizard + steps)
│   │   ├── providers/components/    # 5 components
│   │   ├── settings/components/     # 4 components
│   │   └── history/components/      # 3 components
│   ├── components/
│   │   ├── ui/                      # Reusable Ink components
│   │   └── layout/                  # Global layout, header, footer
│   ├── hooks/                       # 8 app-level hooks
│   ├── config/                      # Navigation config (TO CONSOLIDATE)
│   ├── theme/                       # Color tokens + context
│   └── types/                       # Local types (Shortcut TO REMOVE)
│
├── web/src/                         # Web app (React 19 + Vite)
│   ├── app/
│   │   ├── routes/                  # 14 route files (TanStack Router)
│   │   └── providers/               # Config provider (wraps shared hooks)
│   ├── features/                    # 6 feature domains (mirrors CLI)
│   │   ├── home/
│   │   ├── review/
│   │   │   ├── components/          # 29 components
│   │   │   └── hooks/               # 8 hooks (4 lifecycle + 4 keyboard)
│   │   ├── onboarding/
│   │   ├── providers/
│   │   ├── settings/
│   │   └── history/
│   ├── components/ui/               # Reusable web components
│   ├── hooks/                       # App-level hooks
│   └── config/                      # Navigation config (TO CONSOLIDATE)
│
packages/
├── api/src/
│   ├── hooks/                       # Shared React hooks (22 exports)
│   │   ├── config.ts                # 9 config hooks
│   │   ├── review.ts                # 6 review hooks
│   │   ├── trust.ts                 # 2 trust hooks
│   │   ├── server.ts                # 2 server hooks + ServerState
│   │   ├── use-review-stream.ts     # 1 streaming hook (useReducer)
│   │   ├── match-query-state.ts     # matchQueryState utility
│   │   ├── context.ts               # ApiProvider + useApi
│   │   ├── queries/                 # 4 query factory files
│   │   └── index.ts                 # Barrel exports
│   ├── bound.ts                     # createApi + BoundApi (30 methods)
│   ├── client.ts                    # HTTP client
│   └── [domain].ts                  # 4 domain modules (config, review, git, shutdown)
│
├── core/src/
│   ├── review/                      # Review reducer, streaming, filtering, lenses
│   ├── severity.ts                  # Severity re-exports (UNUSED EXPORTS TO REMOVE)
│   ├── format.ts                    # formatTime, formatTimestamp
│   └── [util].ts                    # errors, result, strings, json
│
├── schemas/src/
│   ├── review/                      # Review, issue, lens schemas
│   ├── events/                      # Agent, step, enrich event schemas
│   ├── config/                      # Provider, settings schemas
│   ├── ui/                          # UI types (Shortcut, severity, display)
│   └── [domain]/                    # git, context, errors
│
└── hooks/src/                       # Non-API hooks (getFigletText, useTimer)
```

**Structure Decision**: Existing monorepo structure is retained. No new packages or directories are created. Changes are consolidation within existing structure.

## Work Streams (5 parallel streams, ordered by dependency)

### Stream 1: DRY Consolidation (5 tasks, ~15 files)

| # | Task | Files Modified | Depends On |
|---|------|---------------|------------|
| 1.1 | Extract `NavigationConfig` types + constants to `@diffgazer/schemas/ui` or `@diffgazer/core` | `packages/schemas/src/ui/ui.ts`, `apps/cli/src/config/navigation.ts`, `apps/web/src/config/navigation.ts` | — |
| 1.2 | Remove CLI-local `Shortcut` type definitions, import from `@diffgazer/schemas/ui` | `apps/cli/src/types/components.ts`, `apps/cli/src/config/navigation.ts` | 1.1 |
| 1.3 | Consolidate `formatTimestamp` to use `@diffgazer/core/format` everywhere | `apps/cli/src/features/review/components/activity-log.tsx`, `apps/cli/src/app/screens/settings/diagnostics-screen.tsx`, `apps/web/src/features/settings/components/diagnostics/page.tsx` | — |
| 1.4 | Fix `SEVERITY_LABELS` import in web `severity-breakdown.tsx` | `apps/web/src/components/ui/severity/severity-breakdown.tsx` | — |
| 1.5 | Extract `useDiagnosticsData()` shared hook | `packages/api/src/hooks/`, `apps/cli/src/app/screens/settings/diagnostics-screen.tsx`, `apps/web/src/features/settings/components/diagnostics/page.tsx` | — |

### Stream 2: SRP Decomposition (3 tasks, ~8 files)

| # | Task | Files Modified | Depends On |
|---|------|---------------|------------|
| 2.1 | Decompose CLI `useReviewLifecycle` into focused hooks (start, completion) matching web's 4-hook structure | `apps/cli/src/features/review/hooks/` | — |
| 2.2 | Split web `useReviewResultsKeyboard` (208 lines, 16 returns) into `useIssueSelection`, `useSeverityFilter`, `useTabNavigation` | `apps/web/src/features/review/hooks/` | — |
| 2.3 | Extract data + keyboard from web `DiagnosticsPage` into `useDiagnosticsState()` + `useDiagnosticsKeyboard()` | `apps/web/src/features/settings/components/diagnostics/page.tsx` | 1.5 |

### Stream 3: matchQueryState Adoption (1 task, ~12 files)

| # | Task | Files Modified | Depends On |
|---|------|---------------|------------|
| 3.1 | Adopt `matchQueryState` in all single-query screens: settings storage/analysis/agent-execution (both apps), providers (both apps), settings hub (both apps), trust permissions (CLI) | 12 screen files across both apps | — |

### Stream 4: YAGNI Cleanup (1 task, ~8 files)

| # | Task | Files Modified | Depends On |
|---|------|---------------|------------|
| 4.1 | Remove dead exports and unused code: unused severity re-exports, `FALLBACK_LENSES`, `TableColumn`, `FigletFont`, `UseTimerOptions`/`UseTimerResult`, `SHOW_HELP_IN_MAIN_MENU`; standardize CLI Spinner imports | ~8 files across packages + apps | — |

### Stream 5: CLI Responsive Improvements (1 task, ~6 files)

| # | Task | Files Modified | Depends On |
|---|------|---------------|------------|
| 5.1 | Centralize breakpoint constants, fix hardcoded separators, consolidate `useStdout` through `useTerminalDimensions` | `apps/cli/src/hooks/use-terminal-dimensions.ts`, footer, panel, section-header, 3 screens | — |

## Agent Parallelization Strategy

All 5 streams are independent and can be executed in parallel. Within streams, tasks with dependencies must be sequential. Recommended agent allocation:

| Agent Group | Stream | Tasks | Agent Count |
|-------------|--------|-------|-------------|
| DRY agents | Stream 1 | 1.1-1.5 | 5 (1.1→1.2 sequential, rest parallel) |
| SRP agents | Stream 2 | 2.1-2.3 | 3 (2.3 waits on 1.5) |
| matchQueryState agents | Stream 3 | 3.1 | 6 (one per screen pair: storage, analysis, agent-exec, providers, hub, trust) |
| YAGNI agents | Stream 4 | 4.1 | 3 (split by package: core, schemas, hooks+cli) |
| Responsive agents | Stream 5 | 5.1 | 2 (breakpoints + separators) |
| Review agents | Post-impl | Verify | 5 (one per stream) |
| **Total** | | | **24 agents** |

Post-implementation, launch 5 review agents (one per stream) to verify changes compile and don't break functionality.

## Verification Plan

1. **Build check**: `pnpm build` — all packages and apps compile
2. **Type check**: `pnpm type-check` — zero TypeScript errors
3. **CLI smoke test**: `pnpm dev:cli` — launch CLI, navigate all screens
4. **Web smoke test**: `pnpm dev:web` — launch web, navigate all routes
5. **Shared hook integrity**: Verify `@diffgazer/api/hooks` barrel exports unchanged (no removals)
6. **Audit grep**: Search for duplicated patterns post-fix:
   - `grep -r "interface Shortcut" apps/cli/` → 0 results
   - `grep -r "formatTimestamp" apps/` → only imports from `@diffgazer/core/format`
   - `grep -r "SEVERITY_LABELS" apps/web/` → only imports from `@diffgazer/schemas/ui`

## Complexity Tracking

No constitution violations to justify.
