# Stargazer UI/Keyboard Validation Report (2026-02-07)

## Executive Summary
Validation and remediation were executed against the current monorepo state.

Primary regressions reported by user:
1. Colors/tokens not behaving correctly with the new UI implementation.
2. Keyboard navigation regressions.

Both were addressed and re-validated:
- Theme/token contract in `apps/web` was synchronized to the new `@stargazer/ui` token model.
- Keyboard navigation coupling for package-level `CheckboxGroup`/`RadioGroup` was restored.
- Automated regression checks and build/test gates are passing.

## What Was Changed

### 1) Color and Token Contract Fixes
Synchronized active web styles with the library style contract:
- Updated `apps/web/src/styles/theme.css`
- Updated `apps/web/src/styles/index.css`

Source of truth used:
- `packages/ui/src/styles/theme.css`
- `packages/ui/src/styles/index.css`

Impact:
- Removed legacy token mismatches in active web theme file set.
- Added/retained semantic bridges used by extracted UI components (`success`, `warning`, `severity-nit`, safe radius math, etc.).

Validation result:
- Legacy/stale token pattern count in `apps/web/src/styles`: `0`

### 2) Keyboard Navigation Fixes in UI Package
Restored keyboard hook integration in UI form groups:
- Updated `packages/ui/src/components/checkbox.tsx`
  - integrated `useGroupNavigation` from `@stargazer/keyboard`
  - added loop/boundary behavior in group navigation
  - preserved checkbox indeterminate rendering
- Updated `packages/ui/src/components/radio-group.tsx`
  - integrated `useGroupNavigation` from `@stargazer/keyboard`
  - added loop/boundary behavior in group navigation

Robustness fix in keyboard core:
- Updated `packages/keyboard/src/use-group-navigation.ts`
  - guarded `scrollIntoView` with optional call (`scrollIntoView?.`) to avoid non-browser/jsdom runtime errors

### 3) Added Keyboard Regression Tests
Added integration tests to validate keyboard behavior with actual package components:
- Added `apps/web/src/components/shared/keyboard-navigation.integration.test.tsx`

Scenarios covered:
- ArrowDown + Space toggles focused checkbox item.
- ArrowDown + Enter selects focused radio item.

## Extraction and Usage Validation

### Keyboard package migration
- Legacy keyboard imports in `apps/web/src`: `0`
- `@stargazer/keyboard` imports in `apps/web/src`: `24`
- Root provider wiring confirmed at `apps/web/src/app/providers/index.tsx`

### UI package migration
- `@stargazer/ui` imports in `apps/web/src`: `50`
- Local `@/components/ui/*` imports in `apps/web/src`: `11`

Per current product decision, remaining local imports are accepted for app-bound reusable modules and tracked by allowlist:
- `docs/reports/ui-allowlist-2026-02-07.json`

## Build and Test Evidence
- `pnpm --filter @stargazer/web test` -> PASS (`18` files, `137` tests)
- `pnpm --filter @stargazer/web build` -> PASS
- `pnpm --filter @stargazer/keyboard exec vitest run` -> PASS (`3` files, `35` tests incl. `1` skipped)
- `pnpm --filter @stargazer/ui exec tsc -p tsconfig.json --noEmit` -> PASS

## Open Items / Residual Risk
1. Medium: hardcoded color classes remain in allowlisted/local app-bound files.
   - Count in `apps/web/src`: `25`
   - Count in `packages/ui/src`: `0`
2. Optional next pass: migrate or normalize hardcoded color classes in local app-bound components if you want stricter visual consistency.

## Artifacts
- `docs/reports/ui-keyboard-validation-checklist-2026-02-07.md`
- `docs/reports/ui-keyboard-validation-2026-02-07.md`
- `docs/reports/ui-allowlist-2026-02-07.json`
