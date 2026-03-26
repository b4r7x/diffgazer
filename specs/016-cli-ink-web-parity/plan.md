# Implementation Plan: CLI Ink Web Parity & Cross-Workspace Quality

**Branch**: `016-cli-ink-web-parity` | **Date**: 2026-03-26 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/016-cli-ink-web-parity/spec.md`

## Summary

Fix CLI terminal resize responsiveness (P1 bug — `useTerminalDimensions` doesn't re-render on resize), add layout centering to match web visual parity, consolidate duplicated hooks/utilities into shared packages, verify complete screen parity, and perform cross-workspace code quality cleanup.

## Technical Context

**Language/Version**: TypeScript 5.x (strict: true), ESM only, .js extensions in imports
**Primary Dependencies**: React 19, Ink 6 (CLI), TanStack Query v5, TanStack Router (web), Vite 7 (web), Zod 4, keyscope, diff-ui
**Storage**: File-based (JSON config, review data)
**Testing**: vitest
**Target Platform**: macOS/Linux terminal (CLI), Browser (web)
**Project Type**: Monorepo (pnpm workspace) — CLI app + Web app + shared packages
**Performance Goals**: Terminal resize → layout update within 1 render frame
**Constraints**: Ink 6's `useStdout()` returns static context; resize requires manual `useState` + event listener
**Scale/Scope**: ~13 screens (CLI), ~13 routes (web), 25+ shared hooks, 6 consolidation targets

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Constitution is template (not configured for this project). No gates to enforce. Proceeding with project-level conventions from CLAUDE.md:
- ESM only ✓
- Strict TypeScript ✓
- No manual useCallback/useMemo (React 19 Compiler) ✓
- Result<T,E> for error handling ✓
- Shared hooks in `@diffgazer/api/hooks` ✓
- No mock data in web ✓

## Project Structure

### Documentation (this feature)

```text
specs/016-cli-ink-web-parity/
├── spec.md
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   ├── responsive-hook-contract.md
│   ├── layout-centering-contract.md
│   └── hook-sharing-contract.md
└── checklists/
    └── requirements.md
```

### Source Code (repository root)

```text
apps/cli/src/
├── hooks/
│   └── use-terminal-dimensions.ts    # FIX: add useState + resize listener
├── app/screens/
│   ├── home-screen.tsx               # ADD: centering
│   ├── help-screen.tsx               # ADD: centering
│   ├── settings/hub-screen.tsx       # ADD: centering
│   ├── settings/analysis-screen.tsx  # ADD: centering
│   ├── settings/agent-execution-screen.tsx  # ADD: centering
│   ├── settings/diagnostics-screen.tsx      # ADD: centering
│   ├── settings/storage-screen.tsx          # ADD: centering
│   ├── settings/theme-screen.tsx            # ADD: centering
│   └── settings/trust-permissions-screen.tsx # ADD: centering
├── features/
│   ├── review/hooks/use-review-lifecycle.ts  # SIMPLIFY: use shared base
│   ├── onboarding/components/steps/
│   │   ├── storage-step.tsx          # REMOVE: thin wrapper
│   │   ├── analysis-step.tsx         # REMOVE: thin wrapper
│   │   └── api-key-step.tsx          # REMOVE: thin wrapper
│   └── onboarding/components/onboarding-wizard.tsx  # FIX: align step order

apps/web/src/
├── app/routes/help.tsx               # FIX: implement actual content
├── features/
│   ├── review/hooks/use-review-lifecycle.ts  # SIMPLIFY: use shared base
│   ├── review/components/review-container.utils.ts  # FIX: use shared getAgentDetail
│   └── providers/components/api-key-dialog/api-key-method-selector.tsx  # REMOVE: re-export
├── components/shared/wizard-layout.tsx  # REMOVE: dead code

packages/api/src/hooks/
├── use-review-lifecycle-base.ts      # NEW: shared lifecycle orchestration
└── index.ts                          # UPDATE: add new exports

packages/schemas/src/
├── events/lens-options.ts            # NEW: buildLensOptions()
└── ui/shortcuts.ts                   # UPDATE: add areShortcutsEqual()

packages/core/src/
├── providers/display-status.ts       # NEW: getDisplayStatusConfig()
└── navigation/back-target.ts         # NEW: getBackTarget()
```

**Structure Decision**: Existing monorepo structure is correct. Changes are modifications to existing files + new shared utilities in existing packages. No new packages or structural changes needed.

## Implementation Phases

### Phase A: Fix Terminal Resize (P1) — 1 file

Fix `useTerminalDimensions` in `apps/cli/src/hooks/use-terminal-dimensions.ts`:
- Add `useState<TerminalDimensions>` initialized from current stdout dimensions
- Add `useEffect` subscribing to `stdout.on('resize', handler)` with cleanup
- `useResponsive()` automatically works since it derives from `useTerminalDimensions()`

**Verification**: Run `pnpm dev:cli`, resize terminal on every screen — layout must reflow immediately.

### Phase B: Layout Centering (P2) — ~10 files

Add centering to menu/settings/single-panel screens using the pattern:
```tsx
<Box justifyContent="center" alignItems="center" flexGrow={1}>
  <Box width={Math.min(columns, MAX_WIDTH)}>
    {content}
  </Box>
</Box>
```

Screens: home, settings hub, all 7 settings sub-screens, help, onboarding, review summary.
Full-width screens (review results/progress, history, providers) — no changes, already responsive.

**Verification**: Compare each screen visually against web at 80/120/160 column widths.

### Phase C: Hook & Utility Consolidation (P3) — ~15 files

1. Extract `buildLensOptions()` to `@diffgazer/schemas/events` → update 3 consumers
2. Make web's `getSubstepDetail()` call `getAgentDetail()` from `@diffgazer/core/review`
3. Extract display status mapping to `@diffgazer/core` → update 4 provider components
4. Extract `ProviderWithStatus`/`DisplayStatus` types to `@diffgazer/schemas/config`
5. Extract `getBackTarget()` to `@diffgazer/core` → update CLI + web
6. Extract `useReviewLifecycleBase` to `@diffgazer/api/hooks` → simplify both app wrappers
7. Move `areShortcutsEqual` to `@diffgazer/schemas/ui`
8. Move `isOpenRouterCompatible`/`mapOpenRouterModels` to shared location

**Verification**: `pnpm run type-check` passes. Both apps start and all screens work.

### Phase D: Screen Parity Fixes (P4) — ~3 files

1. Implement help page content in web (port from CLI's keyboard shortcuts reference)
2. Align onboarding step order (both start with storage)
3. Align trust `runCommands` toggle behavior

**Verification**: Walk through every screen in both apps and compare.

### Phase E: Quality Cleanup (P5) — ~10 files

1. Remove CLI thin wrappers: `StorageStep`, `AnalysisStep`, `ApiKeyStep` → inline at call site in `onboarding-wizard.tsx`
2. Delete web dead code: `WizardLayout`
3. Remove web re-export: `api-key-method-selector.tsx` in providers dialog → import from shared
4. Clean JSX section comments (provider-details, card-layout, trust-permissions-content)
5. Document or fix no-op `useKey` handlers
6. Remove redundant `PROVIDER_FILTER_VALUES` array

**Verification**: `pnpm run type-check` passes. Both apps start. No unused exports.

### Phase F: Final Verification — manual

1. Run CLI at 40/80/120/160/200 column widths — verify all screens
2. Resize terminal rapidly during review stream — verify no state loss
3. Resize while overlay is open (model select, API key) — verify reflow
4. Verify every web route has a CLI screen with matching data
5. Verify keyboard navigation paths match web navigation paths

## Complexity Tracking

No constitution violations to justify. All changes are incremental modifications to existing code. No new packages, no new abstractions, no architectural changes.
