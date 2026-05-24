# Task T-FIELD-CTL — Field.Control narrower typing + Popover/Dialog contract align

**Source findings:** NEW-042, NEW-043
**Severity:** Low
**Phase:** 4
**Blocks:** none
**Blocked by:** none

## Goal
Two small consistency items:

1. **NEW-042:** `libs/ui/registry/ui/field/field.tsx:149-152` — `Field.Control children: ReactElement<FieldControlChildProps>` doesn't narrow per concrete control. Wiring works, but autocomplete on the wrapped child is generic. Tighten if practical without breaking existing usage.

2. **NEW-043:** Popover with `role="dialog"` THROWS for missing accessible name (`popover-content.tsx:101`); Dialog WARNS-AND-FALLBACKS (`dialog-content.tsx:92`). Mixed contract. Pick one and align (recommend warn-and-fallback — matches Dialog).

## Files to touch (allowlist)
- `libs/ui/registry/ui/field/field.tsx`
- `libs/ui/registry/ui/popover/popover-content.tsx`
- Related tests
- Regenerated public registries

## Files NOT to touch
- Dialog behavior (already correct)
- Other components

## Acceptance criteria
- [ ] Popover with `role="dialog"` and no accessible name warns AND falls back to a sensible label instead of throwing
- [ ] Existing tests that expect the throw are updated to expect warn (or vice versa if you pick throw-everywhere)
- [ ] Optional NEW-042: Field.Control children type narrows per-control where practical (don't break existing consumers)
- [ ] All existing tests pass

## Verification commands
```bash
cd /Users/voitz/Projects/diffgazer-workspace
pnpm --filter @diffgazer/ui test -- field popover dialog
pnpm --filter @diffgazer/ui type-check
pnpm --filter @diffgazer/ui validate:registry
```

## Notes & references
- Spec 029 §NEW-042, NEW-043

## Non-goals
- Do not change the public Field or Popover API surface beyond the throw→warn change
- Do not add throwOnMissingLabel options
