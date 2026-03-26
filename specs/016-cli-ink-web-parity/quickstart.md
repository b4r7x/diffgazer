# Quickstart: CLI Ink Web Parity

## Prerequisites

- Node.js 20+
- pnpm workspace already bootstrapped (`pnpm run bootstrap`)
- Familiar with Ink 6 (`<Box>`, `<Text>`, `useStdout()`, `useInput()`)
- Familiar with `@diffgazer/api/hooks` shared hook patterns

## Build Order

```
1. Fix useTerminalDimensions (resize reactivity)     — no dependencies
2. Add centering to layout components                 — depends on (1) for responsive dimensions
3. Consolidate shared hooks/utilities                 — independent of (1-2)
4. Fix screen parity gaps                             — independent of (1-3)
5. Cross-workspace quality cleanup                    — depends on (3) for shared locations
6. Verify all screens                                 — depends on all above
```

## Quick Verification

```bash
# After fixing resize hook:
cd /Users/voitz/Projects/diffgazer-workspace/diffgazer
pnpm dev:cli
# Resize terminal window — all views should reflow immediately

# After layout changes:
# Compare each CLI screen to web at 80/120/160 column widths

# After hook consolidation:
pnpm --filter @diffgazer/api build
pnpm dev:cli   # verify CLI still works
pnpm dev:web   # verify web still works

# Type check everything:
pnpm run type-check
```

## Key Files to Modify

### P1: Resize Fix
- `apps/cli/src/hooks/use-terminal-dimensions.ts` — add `useState` + resize listener

### P2: Layout Centering
- `apps/cli/src/app/screens/home-screen.tsx` — center menu + sidebar
- `apps/cli/src/app/screens/settings/hub-screen.tsx` — center panel
- `apps/cli/src/app/screens/settings/*.tsx` — center single-panel screens
- `apps/cli/src/app/screens/help-screen.tsx` — center content
- `apps/cli/src/features/onboarding/components/onboarding-wizard.tsx` — center wizard

### P3: Hook Consolidation
- `packages/api/src/hooks/` — add shared lifecycle base, export utilities
- `packages/schemas/src/events/` — add `buildLensOptions`
- `packages/schemas/src/ui/` — add `areShortcutsEqual`
- `packages/core/src/` — add `getDisplayStatusConfig`, `getBackTarget`
- `apps/cli/src/features/review/hooks/use-review-lifecycle.ts` — simplify to use shared base
- `apps/web/src/features/review/hooks/use-review-lifecycle.ts` — simplify to use shared base

### P4: Parity Fixes
- `apps/web/src/app/routes/help.tsx` — implement actual help content
- `apps/cli/src/features/onboarding/components/onboarding-wizard.tsx` — align step order
- Trust `runCommands` toggle alignment

### P5: Quality Cleanup
- Remove CLI thin wrappers: `StorageStep`, `AnalysisStep`, `ApiKeyStep`
- Delete web dead code: `WizardLayout`
- Remove web re-export: `api-key-method-selector.tsx`
- Clean JSX section comments, no-op handlers, redundant arrays
