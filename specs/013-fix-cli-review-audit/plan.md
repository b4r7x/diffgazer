# Implementation Plan: Fix CLI Review Regression & Quality Audit

**Branch**: `013-fix-cli-review-audit` | **Date**: 2026-03-25 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/013-fix-cli-review-audit/spec.md`

## Summary

Fix the CLI review hang (regression from 012 refactor) caused by a missing stale-session recovery path in `useReviewStart`, then consolidate 6 duplicated business logic functions into shared packages, fix 3 settings screen bugs, remove dead code, and complete remaining 012 tasks (matchQueryState adoption, responsive breakpoints). Designed for up to 50 parallel agents.

## Technical Context

**Language/Version**: TypeScript 5.x (strict: true), ESM only, .js extensions in imports
**Primary Dependencies**: React 19, Ink 6 (CLI), TanStack Query v5, Vite 7 (web), Zod 4
**Storage**: File-based (JSON config, review data), OS keyring for secrets
**Testing**: vitest (manual smoke testing for this feature — no new test files)
**Target Platform**: macOS/Linux terminal (CLI), Browser (web)
**Project Type**: Monorepo — apps/cli (Ink), apps/web (React/Vite), packages/api, packages/core, packages/schemas, packages/hooks
**Performance Goals**: CLI review must not hang; all steps must progress
**Constraints**: Web is source of truth for UI behavior. No manual useCallback/useMemo (React 19 Compiler). Result<T,E> for error handling in core, try/catch acceptable in hooks/UI.
**Scale/Scope**: ~35 files modified across 6 packages

## Constitution Check

*Constitution is an unfilled template — no project-specific gates defined. Proceeding with standard quality gates from CLAUDE.md.*

- [x] ESM only — all imports use .js extensions
- [x] Strict TypeScript — no `any`, no `!` assertions
- [x] Web is source of truth — CLI mirrors web behavior
- [x] Shared data in `@diffgazer/core` — no business logic in app code
- [x] Both apps use `@diffgazer/api/hooks` — no direct fetch
- [x] No manual memoization — React 19 Compiler auto-memoizes
- [x] Result<T,E> for error handling in core

## Project Structure

### Documentation (this feature)

```text
specs/013-fix-cli-review-audit/
├── plan.md              # This file
├── research.md          # Root cause analysis, divergence assessment, decisions
├── data-model.md        # State machines, extracted function signatures
├── quickstart.md        # Build + verify commands
├── contracts/           # Shared function contracts
│   └── shared-functions.md
└── checklists/
    └── requirements.md  # Spec quality checklist
```

### Source Code (files to modify)

```text
# Shared packages (extract shared functions)
packages/core/src/format.ts                    # Add getProviderStatus, getProviderDisplay
packages/core/src/review/index.ts              # Add mapStepStatus, getAgentDetail
packages/schemas/src/ui/ui.ts                  # Add TAG_BADGE_VARIANTS

# CLI review fix (P1 — the critical bug)
apps/cli/src/features/review/hooks/use-review-start.ts          # REWRITE to web's DI pattern
apps/cli/src/features/review/hooks/use-review-completion.ts     # Align delay logic with web
apps/cli/src/features/review/hooks/use-review-lifecycle.ts      # Update to pass DI props

# CLI shared function consumers (P1 — DRY consolidation)
apps/cli/src/components/layout/global-layout.tsx                # Import getProviderStatus/Display
apps/cli/src/features/review/components/review-progress-view.tsx # Import mapStepStatus, getAgentDetail
apps/cli/src/features/review/components/review-results-view.tsx  # Import filterIssuesBySeverity
apps/cli/src/features/review/components/activity-log.tsx         # Import TAG_BADGE_VARIANTS

# Web shared function consumers (P1 — DRY consolidation)
apps/web/src/components/layout/global-layout.tsx                # Import getProviderStatus/Display
apps/web/src/features/review/components/activity-log.tsx         # Import TAG_BADGE_VARIANTS (if local)

# Settings screen bug fixes (P2)
apps/cli/src/app/screens/settings/providers-screen.tsx          # Display delete errors
apps/cli/src/app/screens/settings/diagnostics-screen.tsx        # Promise.allSettled for refresh
apps/cli/src/app/screens/settings/agent-execution-screen.tsx    # Default to "sequential"

# Dead code cleanup (P2)
apps/cli/src/config/navigation.ts                               # Remove GLOBAL_SHORTCUTS
apps/cli/src/types/components.ts                                # Remove Size, clean up file
apps/cli/src/components/ui/dialog.tsx                           # Remove section comments
apps/cli/src/features/review/components/review-results-view.tsx # Remove arithmetic comment

# matchQueryState adoption (P2 — remaining 012 tasks)
apps/cli/src/features/home/components/trust-panel.tsx           # Adopt matchQueryState
apps/cli/src/app/screens/settings/hub-screen.tsx                # Adopt matchQueryState

# Responsive breakpoint adoption (P2 — remaining 012 tasks)
apps/cli/src/app/screens/history-screen.tsx                     # Use isNarrow from useResponsive
apps/cli/src/app/screens/settings/providers-screen.tsx          # Use isNarrow from useResponsive
apps/cli/src/components/layout/global-layout.tsx                # Use useTerminalDimensions
apps/cli/src/components/ui/dialog.tsx                           # Use useTerminalDimensions

# Hook interface cleanup (P2)
apps/cli/src/features/review/hooks/use-review-keyboard.ts       # Make onTabSwitch optional
```

**Structure Decision**: Existing monorepo structure preserved. No new packages or directories needed. All changes are modifications to existing files or extraction to existing shared packages.

## Work Streams (5 parallel streams after Phase 1)

### Stream A: Review Bug Fix (P1, CRITICAL, sequential)
Fix the hanging review. 3 files, must be sequential (rewrite start → update lifecycle → verify).

### Stream B: Shared Function Extraction (P1, parallel after core changes)
Extract 6 functions to shared packages, then update all consumers. Core extraction is sequential, consumer updates are parallel.

### Stream C: Settings Bug Fixes (P2, fully parallel)
3 independent bug fixes in 3 different files.

### Stream D: Dead Code + Quality Cleanup (P2, fully parallel)
Dead exports, unnecessary comments, thin wrappers. All independent files.

### Stream E: 012 Completion — matchQueryState + Responsive (P2, fully parallel)
Remaining 012 tasks: matchQueryState adoption in 2 screens, responsive breakpoints in 4 files.

## Phased Execution

### Phase 1: Foundation — Extract Shared Functions (BLOCKS Streams A+B consumers)

Sequential extraction into shared packages. Must complete before consumer updates.

**Tasks (sequential)**:
1. Add `getProviderStatus` + `getProviderDisplay` to `packages/core/src/format.ts`
2. Add `mapStepStatus` + `getAgentDetail` to `packages/core/src/review/index.ts`
3. Add `TAG_BADGE_VARIANTS` to `packages/schemas/src/ui/ui.ts`
4. Build shared packages: `pnpm --filter @diffgazer/core --filter @diffgazer/schemas build`

**Exit criteria**: Shared packages compile with new exports.

### Phase 2: Parallel Execution (up to 50 agents)

All streams run simultaneously after Phase 1 completes.

**Stream A: Review Bug Fix** (3 agents, sequential)
- A1: Rewrite `use-review-start.ts` — adopt web's DI pattern (imperative `getActiveSession`, single `useEffect`, no intermediate phases)
- A2: Update `use-review-lifecycle.ts` — pass DI props to new `useReviewStart` (`api.getActiveReviewSession`, `stream.start`, `stream.resume`, config loading states)
- A3: Align `use-review-completion.ts` — add variable delay (2300ms if report completed, 400ms otherwise), match web's `skipDelayAndComplete` pattern

**Stream B: Consumer Updates for Shared Functions** (6 agents, parallel)
- B1: CLI `global-layout.tsx` — import `getProviderStatus`/`getProviderDisplay` from `@diffgazer/core/format`, delete local functions
- B2: Web `global-layout.tsx` — same as B1
- B3: CLI `review-progress-view.tsx` — import `mapStepStatus`/`getAgentDetail` from `@diffgazer/core/review`, delete local functions and `mapStepsToProgressItems` (inline the trivial map)
- B4: CLI `review-results-view.tsx` — replace local `filterIssues` with `filterIssuesBySeverity` from `@diffgazer/core/review`, delete local function
- B5: CLI `activity-log.tsx` — import `TAG_BADGE_VARIANTS` from `@diffgazer/schemas/ui`, delete local `tagToBadgeVariant`, align `agent → "info"`
- B6: Web activity log — verify shared `TAG_BADGE_VARIANTS` import (may already be correct)

**Stream C: Settings Bug Fixes** (3 agents, parallel)
- C1: `providers-screen.tsx` — render `deleteCredentials.error` message in the success path JSX
- C2: `diagnostics-screen.tsx` — replace sequential refresh calls with `Promise.allSettled([retryServer(), refetchContext()])`
- C3: `agent-execution-screen.tsx` — change default from `"parallel"` to `"sequential"`

**Stream D: Dead Code + Quality** (8 agents, parallel)
- D1: `navigation.ts` — remove `GLOBAL_SHORTCUTS` export
- D2: `types/components.ts` — remove `Size` export, move `Variant` inline to its only consumer (toast.tsx), unify `Shortcut` imports to use `@diffgazer/schemas/ui` directly
- D3: `dialog.tsx` — remove `// --- Types ---`, `// --- Components ---`, `// --- Compound export ---` section comments
- D4: `review-results-view.tsx` — remove `// Reserve rows for header (2), footer (2), borders (2)` comment
- D5: `use-review-keyboard.ts` — make `onTabSwitch` optional in `ReviewKeyboardOptions` interface (add `?`)
- D6: `review-results-view.tsx` — remove the no-op `onTabSwitch()` callback (after D5 makes it optional)
- D7: `trust-panel.tsx` — replace hand-rolled loading/error with `matchQueryState`
- D8: Web diagnostics `page.tsx` — remove unnecessary `useMemo` calls (lines 45, 51) per React 19 Compiler rule

**Stream E: 012 Completion** (6 agents, parallel)
- E1: `diagnostics-screen.tsx` — replace local `formatTimestamp` with `formatTimestampLocale` from `@diffgazer/core/format`
- E2: Web `diagnostics/page.tsx` — replace local `formatTimestamp` with `formatTimestampLocale` from `@diffgazer/core/format`
- E3: Web `severity-breakdown.tsx` — replace local `SEVERITY_LABELS` with import from `@diffgazer/schemas/ui`
- E4: `history-screen.tsx` + `providers-screen.tsx` — replace ad-hoc `columns < 80` with `isNarrow` from `useResponsive()`
- E5: `review-progress-view.tsx` — replace ad-hoc `columns >= 100` with `isWide` from `useResponsive()` (already uses `isWide` — verify)
- E6: `global-layout.tsx` + `dialog.tsx` — replace direct `useStdout()` with `useTerminalDimensions()`

### Phase 3: Verification

**Build check** (1 agent):
```bash
pnpm build && pnpm type-check
```

**Smoke tests** (2 agents, parallel):
- CLI: `pnpm dev:cli` — start review, verify all 5 steps complete, navigate settings screens
- Web: `pnpm dev:web` — start review, verify same flow, compare settings screens

**Consolidation grep** (1 agent):
```bash
# No local implementations of shared functions
grep -rn "function filterIssues" apps/
grep -rn "function getProviderStatus" apps/
grep -rn "function getProviderDisplay" apps/
grep -rn "function mapStepStatus" apps/
grep -rn "function getAgentDetail" apps/
grep -rn "tagToBadgeVariant" apps/

# No dead exports
grep -rn "GLOBAL_SHORTCUTS" apps/cli/src/

# Consistent defaults
grep -rn '"parallel"' apps/cli/src/app/screens/settings/agent-execution-screen.tsx
```

## Agent Distribution Summary

| Stream | Agents | Priority | Dependencies |
|--------|--------|----------|-------------|
| Phase 1: Foundation | 1 | P1 | None — start first |
| Stream A: Review Fix | 3 | P1 | Phase 1 (for mapStepStatus) |
| Stream B: Consumer Updates | 6 | P1 | Phase 1 |
| Stream C: Settings Fixes | 3 | P2 | None |
| Stream D: Dead Code | 8 | P2 | D6 depends on D5 |
| Stream E: 012 Completion | 6 | P2 | None |
| Phase 3: Verification | 4 | — | All streams |
| **Total** | **31** | | |

**Peak parallelism**: 26 agents (Streams B + C + D + E after Phase 1 + Stream A completes)

## Complexity Tracking

No constitution violations to justify — all changes are to existing files using established patterns.
