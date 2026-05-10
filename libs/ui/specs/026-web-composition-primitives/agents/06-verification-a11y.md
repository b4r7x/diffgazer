# Agent 06: Verification And Accessibility

Ownership:

- tests across `libs/keys`, `libs/ui`, and `apps/web`
- validation command execution
- final re-audit notes

Do not make broad source changes unless fixing a small test-discovered issue. Coordinate with source-owning agents.

## Goal

Verify the migration by user-visible behavior and accessibility contracts, not implementation details.

## Test Matrix

Keys:

- navigation item utilities query/focus values correctly
- disabled items are skipped
- nested composite owners do not leak items
- boundary callbacks fire exactly once
- focus restore returns focus to a valid element and fails gracefully when target is gone
- focus zone Tab behavior is documented and tested

UI:

- `NavigationList`: role/name, `aria-activedescendant`, selection, highlight, boundary, disabled item behavior
- `RadioGroup`: one Tab stop, arrows, Home/End, Space/Enter, automatic vs manual activation, required/invalid state
- `Tabs`: automatic and manual activation, Enter/Space in manual mode, focus vs selected state
- `Dialog`: initial focus, trap, Escape, focus restore with and without trigger
- `Select`/combobox: active option announcement, `aria-activedescendant`, search input, empty/loading states
- `Field`: label/control idrefs, description/error idrefs, required/disabled/invalid ownership
- `Field + InputGroup`: Field props reach the real input, not only the visual shell
- `HorizontalStepper`: current step uses `value` and exposes `aria-current="step"`
- `BlockBar`: meter semantics and custom value text when added
- `KeyValue`: remains semantic description list after class-slot changes
- `CodeBlock`/`DiffView`: accessible labels, line numbers, scrollable regions, no local duplicate regression

Web:

- history timeline/runs keyboard flow and boundary handoff
- provider search/filter/list action flow
- model picker radiogroup flow
- API key method selector label/radio/input behavior
- onboarding progress and choice navigation
- review issue list/filter/details/evidence rendering
- settings selectors preserve behavior

## Tests To Move Or Recreate

- Move or recreate `apps/web/src/components/shared/keyboard-navigation.integration.test.tsx` in `libs/ui` because it tests UI + keys contracts, not product behavior.
- Move generic radio/listbox/toggle APG assertions out of app tests when library coverage exists.
- Keep app workflow tests in `apps/web` when they assert route, provider, review, trust, or onboarding behavior.

## Commands

Narrow first:

- `pnpm --filter @diffgazer/keys test`
- `pnpm --filter @diffgazer/ui test`
- `pnpm --filter @diffgazer/web test`

Then:

- `pnpm --filter @diffgazer/keys type-check`
- `pnpm --filter @diffgazer/ui type-check`
- `pnpm --filter @diffgazer/web type-check`
- `pnpm --filter @diffgazer/ui validate:registry`
- `pnpm --filter @diffgazer/keys validate:registry`
- `pnpm --filter @diffgazer/keys verify:rsc`

Final gates:

- `pnpm run prepare:artifacts`
- `pnpm run validate:artifacts:check`
- `pnpm run verify:monorepo`
- `pnpm run verify`

## Acceptance

- Tests use role/label/text and keyboard interactions where possible.
- Tests do not assert Tailwind classes unless class output is public API.
- Keyboard behavior works with real focus movement, not only state updates.
- No app workflow test was moved into a library.
- No library test imports app code.
