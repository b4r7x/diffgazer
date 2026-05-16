# Task T-FORM-RESET — Fix useFormReset subscription + canceled reset semantics

**Source findings:** UI-004, NEW-007
**Severity:** Medium
**Phase:** 4
**Blocks:** none
**Blocked by:** none

## Goal
`libs/ui/registry/hooks/use-form-reset.ts:15` layout effect has no dependency array → removes/adds the native `reset` listener on EVERY render. The hook docs claim the listener stays stable — that claim is inaccurate.

More importantly: the listener calls `onReset(resetValue)` SYNCHRONOUSLY without checking `event.defaultPrevented`. Native form resets are cancelable. If consumer prevents reset, the custom control still resets and diverges from native form state.

Correct shape:
- Stable listener (use `useEffectEvent` + stable effect deps)
- Receive the `reset` event
- Defer reaction until microtask AFTER consumer handlers have run
- Skip when `event.defaultPrevented`
- Then reset custom state

## Files to touch (allowlist)
- `libs/ui/registry/hooks/use-form-reset.ts`
- `libs/ui/registry/hooks/use-form-reset.test.ts` (add cancelable + churn tests)
- `libs/ui/public/r/form-reset.json` (regenerated)

## Files NOT to touch
- Consumers (Field, controlled inputs) — signature should be backwards-compatible

## Acceptance criteria
- [ ] Subscription effect re-runs only when form/target changes — not every render
- [ ] If consumer's own handler calls `event.preventDefault()`, `onReset` is NOT invoked
- [ ] If consumer doesn't prevent, `onReset` is invoked after microtask (so consumer handlers can still cancel)
- [ ] New test: form with custom handler `onReset={(e) => e.preventDefault()}` then user clicks reset — assert custom controls keep their values
- [ ] New test: form re-renders 10 times with stable props; assert `addEventListener` called once, `removeEventListener` never (until unmount)
- [ ] Existing tests pass

## Verification commands
```bash
cd /Users/voitz/Projects/diffgazer-workspace
pnpm --filter @diffgazer/ui test -- form-reset field
pnpm --filter @diffgazer/ui type-check
pnpm --filter @diffgazer/ui build:shadcn
```

## Notes & references
- Spec 029 §UI-004, NEW-007
- HTMLFormElement `reset` event is cancelable: https://developer.mozilla.org/en-US/docs/Web/API/HTMLFormElement/reset_event
- Pattern: `useEffectEvent` for the latest `onReset` callback; layout effect with stable deps for subscription

## Non-goals
- Do not change `useFormReset` public signature
- Do not address other Field reset behaviors
