# Implementation Plan: CLI-Web Full Parity with Shared Infrastructure

**Branch**: `015-cli-web-parity-shared-infra` | **Date**: 2026-03-26 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/015-cli-web-parity-shared-infra/spec.md`

## Summary

Audit and refine the existing diffgazer CLI app (14 screens, 18 Ink components, 26 shared hooks) to achieve full parity with the web app. Three workstreams: (1) fix critical navigation bug blocking all CLI usage, (2) add 10 missing review detail components to CLI and align responsive breakpoints across both platforms, (3) cross-workspace quality audit of all 5 repos with all findings fixed in-place.

## Technical Context

**Language/Version**: TypeScript 5.x (strict: true), ESM only, .js extensions in imports
**Primary Dependencies**: React 19, Ink 6 (CLI), TanStack Query v5, TanStack Router (web), Vite 7 (web), Zod 4, keyscope, diff-ui
**Storage**: File-based (JSON config, review data) — no changes needed
**Testing**: Vitest, @testing-library/react, @testing-library/user-event
**Target Platform**: Node.js (CLI via Ink), Browser (web via Vite)
**Project Type**: Monorepo (5 apps/packages in diffgazer + 4 workspace submodules)
**Performance Goals**: CLI review completion within 5% of web (SC-008)
**Constraints**: Terminal widths 40-200+ columns, shared breakpoints (< 80, 80-119, >= 120)
**Scale/Scope**: 14 CLI screens, 18 Ink components, 10 components to add, 5 repos to audit

## Constitution Check

*GATE: Constitution file is a template (not configured). No gates to enforce. Proceeding.*

**Post-design re-check**: N/A — no constitution gates defined.

## Project Structure

### Documentation (this feature)

```text
specs/015-cli-web-parity-shared-infra/
├── plan.md              # This file
├── research.md          # Phase 0 output (completed)
├── data-model.md        # Phase 1 output (completed)
├── quickstart.md        # Phase 1 output (completed)
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (existing monorepo — changes across 5 repos)

```text
diffgazer/                              # Main monorepo
├── apps/cli/src/
│   ├── app/providers/
│   │   └── keyboard-provider.tsx       # FIX: stale closure bug
│   ├── hooks/
│   │   └── use-scope.ts               # FIX: stack accumulation
│   │   └── use-terminal-dimensions.ts  # UPDATE: shared breakpoints
│   ├── features/review/components/
│   │   ├── issue-details-pane.tsx      # UPDATE: add Trace/Patch tabs
│   │   ├── diff-view.tsx              # NEW: terminal diff viewer
│   │   ├── agent-board.tsx            # NEW: agent state visualization
│   │   ├── context-snapshot-preview.tsx # NEW: context preview
│   │   ├── review-metrics-footer.tsx  # NEW: metrics during review
│   │   ├── fix-plan-checklist.tsx     # NEW: interactive checklist
│   │   ├── severity-filter-group.tsx  # NEW: filter button group
│   │   ├── no-changes-view.tsx        # NEW: dedicated view
│   │   └── api-key-missing-view.tsx   # NEW: dedicated view
│   └── features/review/components/
│       └── review-progress-view.tsx    # UPDATE: add AgentBoard, metrics
├── apps/web/src/
│   ├── hooks/
│   │   └── use-viewport-breakpoint.ts # NEW: JS viewport detection
│   └── features/review/components/
│       └── issue-details-pane.tsx      # UPDATE: add betterOptions, testsToAdd
├── packages/core/src/
│   └── layout/
│       └── breakpoints.ts             # NEW: shared breakpoint constants

cli-core/                               # Upstream package (audit only)
registry-kit/                           # Upstream package (audit only)
keyscope/                               # Upstream package (audit only)
diff-ui/                                # Upstream package (audit only)
```

**Structure Decision**: Existing monorepo + workspace structure. No new packages or apps. Changes distributed across existing directories following established patterns (features/, components/ui/, hooks/).

## Implementation Phases

### Phase A: Fix CLI Navigation (Blocker — Must Complete First)

**Priority**: P1 — blocks all other work
**Estimated parallel agents**: 3

#### A1. Fix keyboard-provider stale closure
- File: `apps/cli/src/app/providers/keyboard-provider.tsx`
- Replace `useState<string[]>([])` with `useRef<string[]>([])` for scopeStack
- Keep `useState` counter for re-render triggers only
- Update `useInput` handler to read `scopeStackRef.current`
- Verify: scope-registered handlers fire correctly

#### A2. Fix useScope stack accumulation
- File: `apps/cli/src/hooks/use-scope.ts`
- Add dedup guard: check if scope is already on top before pushing
- Add bounds check: prevent unbounded stack growth
- Verify: navigate between screens, return home — stack has correct single entry

#### A3. Verify TrustPanel keyboard navigation
- File: `apps/cli/src/app/screens/home-screen.tsx`
- Ensure TrustPanel has working keyboard navigation for fresh projects
- Test: fresh project → TrustPanel renders → user can interact → grant trust → HomeMenu appears
- Test: all 7 menu items navigate to correct screens

### Phase B: Add Missing CLI Review Components (Feature Gaps)

**Priority**: P1 — core review experience parity
**Estimated parallel agents**: 10 (each component independent)
**Depends on**: Phase A (need working navigation to verify)

#### B1. Add Trace tab to IssueDetailsPane
- Update: `apps/cli/src/features/review/components/issue-details-pane.tsx`
- Add "Trace" tab showing agent tool execution history
- Data: step, tool name, input/output, artifacts
- Reference: `apps/web/src/features/review/components/issue-details-pane.tsx`

#### B2. Add Patch tab with terminal diff viewer
- New: `apps/cli/src/features/review/components/diff-view.tsx`
- Ink-based diff view showing suggested patches
- Update IssueDetailsPane to include Patch tab
- Reference: `apps/web/src/features/review/components/diff-view.tsx`

#### B3. Add interactive fix plan checklist
- New: `apps/cli/src/features/review/components/fix-plan-checklist.tsx`
- Replace read-only fix plan list with interactive checkboxes
- Track completion state per step
- Reference: `apps/web/src/features/review/components/fix-plan-checklist.tsx`

#### B4. Add AgentBoard to review progress
- New: `apps/cli/src/features/review/components/agent-board.tsx`
- Show agent states during review streaming
- Update ReviewProgressView to include AgentBoard
- Reference: `apps/web/src/features/review/components/agent-board.tsx`

#### B5. Add ContextSnapshotPreview
- New: `apps/cli/src/features/review/components/context-snapshot-preview.tsx`
- Show project context snapshot after context step completes
- Update ReviewProgressView to include it
- Reference: `apps/web/src/features/review/components/context-snapshot-preview.tsx`

#### B6. Add ReviewMetricsFooter
- New: `apps/cli/src/features/review/components/review-metrics-footer.tsx`
- Show files processed, issues found, elapsed time during review
- Update ReviewProgressView to include it
- Reference: `apps/web/src/features/review/components/review-metrics-footer.tsx`

#### B7. Add SeverityFilterGroup
- New: `apps/cli/src/features/review/components/severity-filter-group.tsx`
- Replace inline filter cycling with structured filter button group
- Update IssueListPane to use it
- Reference: `apps/web/src/features/review/components/severity-filter-group.tsx`

#### B8. Add dedicated NoChangesView
- New: `apps/cli/src/features/review/components/no-changes-view.tsx`
- Replace generic callout with dedicated view offering mode switch
- Reference: `apps/web/src/features/review/components/no-changes-view.tsx`

#### B9. Add dedicated ApiKeyMissingView
- New: `apps/cli/src/features/review/components/api-key-missing-view.tsx`
- Replace generic callout with dedicated view offering settings navigation
- Reference: `apps/web/src/features/review/components/api-key-missing-view.tsx`

#### B10. Add betterOptions and testsToAdd to web IssueDetailsPane
- Update: `apps/web/src/features/review/components/issue-details-pane.tsx`
- Add `betterOptions` array display (CLI has it, web doesn't)
- Add `testsToAdd` array display (CLI has it, web doesn't)
- Ensures true bi-directional parity

### Phase C: Shared Responsive Breakpoints with Live Detection

**Priority**: P2 — layout parity
**Estimated parallel agents**: 4
**Depends on**: Phase A (need working navigation to test)

#### C1. Create shared breakpoint constants
- New: `packages/core/src/layout/breakpoints.ts`
- Export `BREAKPOINTS` with 3 tiers: narrow (< 80 / < 768px), medium (80-119 / 768-1023px), wide (>= 120 / >= 1024px)
- Export type `BreakpointTier = "narrow" | "medium" | "wide"`
- Export helper `getBreakpointTier(columns: number): BreakpointTier`
- Update `packages/core/src/index.ts` to export new module

#### C2. Update CLI responsive hook
- Update: `apps/cli/src/hooks/use-terminal-dimensions.ts`
- Import shared breakpoints from `@diffgazer/core`
- Replace hardcoded 80/100 with shared constants
- Add `isMedium` boolean, rename `isWide` threshold from 100 to 120
- Return `tier: BreakpointTier` alongside booleans

#### C3. Add web viewport breakpoint hook
- New: `apps/web/src/hooks/use-viewport-breakpoint.ts`
- Use `matchMedia` for JavaScript-level viewport detection
- Import shared breakpoints from `@diffgazer/core`
- Return `tier: BreakpointTier` and `{ isNarrow, isMedium, isWide }`
- Fire on resize events (live detection)

#### C4. Update all screens to use 3-tier breakpoints
- Update all 4 CLI screens that currently use responsive layouts (providers, history, review-results, review-progress) to use the 3-tier system
- Update web screens that need JS-level responsive logic
- Verify: resize terminal/browser → layouts switch at same breakpoints → no state loss

### Phase D: Cross-Workspace Quality Audit & Fixes

**Priority**: P3 — quality assurance
**Estimated parallel agents**: 5 (one per repo)
**Depends on**: Phases A-C (audit after functional changes)

#### D1. Audit & fix diffgazer monorepo
- Fix `apps/docs/source.config.ts` `as any` cast
- Remove any unnecessary manual useCallback/useMemo in web app
- Verify all screens use matchQueryState where applicable
- Run type-check and tests

#### D2. Audit & fix keyscope
- Review keyboard-provider.tsx useCallback usage
- Verify no anti-patterns
- Run tests: `cd keyscope && pnpm test`

#### D3. Audit & fix diff-ui
- Review command-palette useCallback usage
- Verify component patterns match CLI Ink patterns
- Run type-check

#### D4. Audit & fix cli-core
- Verify no `any` types, no dead code
- Run type-check

#### D5. Audit & fix registry-kit
- Verify no `any` types, no dead code
- Run tests: `cd registry-kit && pnpm test`

### Phase E: End-to-End Verification

**Priority**: P1 — must pass before completion
**Estimated parallel agents**: 3
**Depends on**: All previous phases

#### E1. Screen-by-screen parity verification
- Launch CLI, navigate to every screen
- Compare each screen with web equivalent
- Verify: same data, same controls, same keyboard shortcuts
- Document any remaining gaps

#### E2. Responsive layout verification
- Test CLI at 40, 80, 100, 120, 200 columns
- Test web at equivalent viewport widths
- Verify: same breakpoints trigger same layout changes
- Verify: resize preserves state

#### E3. Full workspace build verification
- Run `pnpm run build` across all 5 repos
- Run `pnpm run type-check` across all 5 repos
- Run all test suites
- Verify: zero failures, zero regressions

## Agent Execution Strategy

This plan is designed for up to 20 parallel Opus agents:

| Phase | Agents | Parallelism | Blocking |
|-------|--------|-------------|----------|
| A (Nav fix) | 3 | All parallel | Blocks B, C, D, E |
| B (Components) | 10 | All parallel | Blocks E |
| C (Breakpoints) | 4 | All parallel | Blocks E |
| D (Quality audit) | 5 | All parallel (one per repo) | Blocks E |
| E (Verification) | 3 | All parallel | Final gate |

**Total**: 25 task slots across 5 phases, max 10 concurrent in Phase B.

Phases B, C, and D can run in parallel after Phase A completes.
