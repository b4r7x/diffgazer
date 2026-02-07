# UI/Keyboard Validation Checklist (2026-02-07)

## Gate 1: Scope Contract
- Status: PASS
- Decision source: user instruction (app-bound reusable UI is allowed to remain local)
- Artifact: `docs/reports/ui-allowlist-2026-02-07.json`

## Gate 2: Keyboard Extraction Hygiene
- Status: PASS
- Legacy keyboard import paths in `apps/web/src`: `0`
- `@stargazer/keyboard` imports in `apps/web/src`: `24`
- Keyboard provider wired in app root: `apps/web/src/app/providers/index.tsx`

## Gate 3: UI Consumption Hygiene
- Status: PASS (with allowlist)
- `@stargazer/ui` imports in `apps/web/src`: `50`
- Local `@/components/ui/*` imports in `apps/web/src`: `11`
- All local imports are covered by allowlist patterns:
  - `@/components/ui/ascii-logo`
  - `@/components/ui/issue`
  - `@/components/ui/progress`
  - `@/components/ui/severity`
  - `@/components/ui/severity/constants`
  - `@/components/ui/severity/severity-breakdown`

## Gate 4: Theme/Token Contract
- Status: PASS
- Legacy token/deprecated patterns in `apps/web/src/styles`: `0`
- Action applied: synchronized
  - `apps/web/src/styles/theme.css`
  - `apps/web/src/styles/index.css`
  with
  - `packages/ui/src/styles/theme.css`
  - `packages/ui/src/styles/index.css`

## Gate 5: Keyboard Behavior Validation
- Status: PASS
- Restored keyboard coupling in library controls:
  - `packages/ui/src/components/checkbox.tsx`
  - `packages/ui/src/components/radio-group.tsx`
- Added integration regression tests:
  - `apps/web/src/components/shared/keyboard-navigation.integration.test.tsx`
- Fixed robustness issue in keyboard package (`scrollIntoView` guard):
  - `packages/keyboard/src/use-group-navigation.ts`

## Gate 6: Build/Test Integrity
- Status: PASS
- `pnpm --filter @stargazer/web test`: PASS (18 files, 137 tests)
- `pnpm --filter @stargazer/web build`: PASS
- `pnpm --filter @stargazer/keyboard exec vitest run`: PASS (3 files, 35 tests incl. 1 skipped)
- `pnpm --filter @stargazer/ui exec tsc -p tsconfig.json --noEmit`: PASS

## Gate 7: Residual Risks
- Status: OPEN (medium)
- Hardcoded color classes still present in `apps/web/src`: `25`
- Hardcoded color classes in `packages/ui/src`: `0`
- Rationale: remaining hardcoded classes are currently in allowlisted/local app-bound UI and layout paths.
