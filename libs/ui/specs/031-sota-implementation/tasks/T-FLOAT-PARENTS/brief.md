# Task T-FLOAT-PARENTS — useFloatingPosition scroll-parent walker (transform/shadow/iframe)

**Source findings:** NEW-005
**Severity:** Medium
**Phase:** 4
**Blocks:** none
**Blocked by:** T-OWNER-DOC (combine with owner-doc change for the same hook), T-FLOAT-THROTTLE

## Goal
`libs/ui/registry/hooks/use-floating-position.ts:211-217` walks only `parentElement` and checks `scrollHeight > clientHeight` / `scrollWidth > clientWidth` without checking `overflow` style. Misses:
- Elements that overflow but don't scroll (`overflow: visible` with oversized children) → wasteful listeners
- Elements with `transform`/`filter`/`perspective` that create new containing blocks
- Shadow DOM hosts
- Iframe boundaries

Replace with Floating UI's `getScrollParents` algorithm (read its source, adapt; don't take the lib as a dep).

## Files to touch (allowlist)
- `libs/ui/registry/hooks/use-floating-position.ts`
- `libs/ui/registry/hooks/use-floating-position.test.ts` (add transform/shadow/iframe scenarios)
- `libs/ui/public/r/floating-position.json` (regenerated)

## Files NOT to touch
- Other overlay hooks
- Popover/Select/Tooltip consumers

## Acceptance criteria
- [ ] Scroll-parent discovery checks computed `overflow` style for `auto`, `scroll`, `overlay`, `hidden` (the last is debatable — match Floating UI's pick)
- [ ] Walker stops at iframe boundaries (test: trigger inside an iframe doesn't walk to host document scroll)
- [ ] Walker handles transformed/filtered ancestors as containing blocks (test: trigger inside `transform: translateZ(0)` ancestor → that ancestor is treated as scroll root if it scrolls)
- [ ] Listeners no longer attach to non-scrollable overflowing elements
- [ ] All existing tests pass

## Verification commands
```bash
cd /Users/voitz/Projects/diffgazer-workspace
pnpm --filter @diffgazer/ui test -- use-floating-position
pnpm --filter @diffgazer/ui type-check
pnpm --filter @diffgazer/ui build:shadcn
```

## Notes & references
- Spec 029 §NEW-005
- Floating UI getScrollParents: https://github.com/floating-ui/floating-ui (read source, adapt)

## Non-goals
- Do not add Floating UI as a dependency
- Do not change positioning algorithm
- Do not address NEW-040 throttling here (separate task)
