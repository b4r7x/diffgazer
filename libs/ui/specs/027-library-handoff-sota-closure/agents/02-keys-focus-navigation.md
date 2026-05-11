# Agent 02: Keys Focus Zone, Navigation, And Focusable Utilities

Model: Opus 4.7
Mode: implementation

## Required Skills

Load before work:

- `$sota`
- `$code-audit`
- `architecture`
- `clean-code`
- `code-quality`
- `anti-slop`
- `test-behavior-not-implementation`
- `typescript-expert`
- `superpowers:test-driven-development`
- `superpowers:verification-before-completion`

## Write Ownership

Primary:

- `libs/keys/src/hooks/use-focus-zone.ts`
- `libs/keys/src/hooks/use-navigation.ts`
- `libs/keys/src/hooks/use-focus-trap.ts`
- `libs/keys/src/hooks/use-scroll-lock.ts`
- `libs/keys/src/utils/navigation-items.ts`
- `libs/keys/src/utils/navigation-directions.ts`
- `libs/keys/src/utils/keyboard-utils.ts`
- `libs/keys/src/utils/focus-restore.ts`
- new focused utilities under `libs/keys/src/utils/`
- adjacent keys tests
- `libs/keys/src/index.ts`

Coordinate before touching:

- `libs/ui/registry/hooks/use-listbox.ts`
- `libs/ui/registry/hooks/use-navigation.ts`
- `apps/web/src/**`

## Issues

- `../issues/KYS-002-focus-zone-targets.md`
- `../issues/KYS-003-navigation-contract.md`
- `../issues/KYS-004-focus-trap-scroll-lock.md`

## Requirements

- Add editable target guards to navigation.
- Add event/key context to boundary callbacks where needed.
- Avoid no-op `preventDefault` for Enter/Space without consumer behavior.
- Validate navigation item values and support `menuitemcheckbox` if needed.
- Centralize focusable discovery and export it if UI needs it.
- Harden focus trap initial focus and hidden/non-focusable filtering.
- Make `useFocusZone` invalid-zone and `tabCycle` behavior explicit and tested.
- Introduce a zone-target focus primitive only if it removes real repeated app focus repair without overbuilding.

## Tests

Use behavior tests for:

- editable targets keep native keyboard editing behavior;
- boundary callbacks include event/key;
- role-only items without values cannot trap navigation;
- disabled behavior by role;
- hidden/inert/non-focusable elements skipped by focus trap;
- initialFocus outside container does not escape trap;
- `tabCycle` invalid entries/current-zone omissions;
- focus-zone target focusing and no focus theft if implemented.

## Verification

Run:

```bash
pnpm --filter @diffgazer/keys test -- use-navigation navigation-items navigation-directions use-focus-zone use-focus-trap use-scroll-lock
pnpm --filter @diffgazer/keys type-check
pnpm --filter @diffgazer/keys validate:registry
```

Report exact output and public API changes.
