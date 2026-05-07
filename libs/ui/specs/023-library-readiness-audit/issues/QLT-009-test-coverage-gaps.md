# QLT-009: Behavior Coverage Still Has Important Gaps

Area: Tests and behavior coverage

Severity: Medium

Priority: P2

Effort: M

## Problem

The suite is broad, but several handoff-critical behaviors are either only unit-tested, tested through implementation details, or not tested in a real browser/consumer shape.

## Evidence

- `cli/add/src/commands/cli-behavior.test.ts:50` and `cli/add/src/utils/add-integration.test.ts:44` cover resolver/CLI behavior but not enough executable `dgadd add ui/...` scenarios for keyboard-integrated UI components across copy/package/none modes.
- `libs/keys/src/hooks/use-navigation.test.tsx:21` and `libs/ui/registry/hooks/testing/use-navigation.test.tsx:19` rely heavily on `data-testid`, direct `KeyboardEvent`, and hook-state spans.
- `libs/ui/registry/ui/scroll-area/scroll-area.test.tsx:16` and `command-palette.test.tsx:22` bypass some user-level interaction or role/name queries.
- Form validity and focus issues need browser-level tests, not only jsdom/axe.

## User Impact

Regressions can pass tests while breaking real keyboard, install, form validation, or consumer behavior.

## Fix

Add targeted executable CLI install tests for keyboard-heavy UI components, move some hook/UI tests toward role/name and `userEvent`, and add browser-level form validity tests.

## Acceptance Criteria

- CLI fixture tests cover a keyboard-dependent UI component in copy mode, keys package mode, and rejected none mode.
- Hook tests still cover public contracts but use real consumer harnesses where useful.
- ScrollArea and CommandPalette tests prefer accessible role/name queries and focused user interaction.
- Browser-level tests cover `reportValidity`, focus target, and FormData for custom controls.

## Verification

Run `pnpm --filter @diffgazer/ui test`, `pnpm --filter @diffgazer/keys test`, `pnpm --filter @diffgazer/add test`, `pnpm run smoke:cli`, and browser-level consumer checks.

