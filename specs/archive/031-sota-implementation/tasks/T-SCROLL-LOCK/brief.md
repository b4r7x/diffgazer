# Task T-SCROLL-LOCK — Document gaps + optional owner-doc default + opt-in flags

**Source findings:** KEYS-002
**Severity:** Medium (no in-repo consumer; real for downstream)
**Phase:** 2
**Blocks:** none
**Blocked by:** none

## Goal
`libs/keys/src/hooks/use-scroll-lock.ts:52` defaults to `document.body` when no target supplied. Refcount and restore-on-unmount work. Missing:
- iOS Safari rubber-band guard (touchmove preventDefault, position-fixed body)
- Desktop scrollbar-gutter compensation (`padding-right` to prevent layout shift)

Two paths:

**Path A (docs only):** Add prominent JSDoc warnings + add an `owner-document aware default`. Don't implement iOS/scrollbar-gutter fixes. Cheap.

**Path B (full SOTA):** Add `preventLayoutShift` and `preventIosRubberBand` opt-in flags. Implement both correctly. Match `react-remove-scroll` parity.

Default to Path A for now (no in-repo consumer; Dialog uses native `<dialog>` which doesn't even use this hook). File Path B as follow-up.

## Files to touch (allowlist)

### Path A
- `libs/keys/src/hooks/use-scroll-lock.ts` (JSDoc + owner-doc default)
- `libs/keys/src/hooks/use-scroll-lock.test.ts` (add test for owner-doc default)
- `libs/keys/docs/content/hooks/use-scroll-lock.mdx` (document limitations)
- `libs/keys/public/r/scroll-lock.json` (regenerated)

### Path B
- All Path A files PLUS
- New tests for iOS rubber-band (simulate touchmove)
- New tests for scrollbar-gutter compensation (measure padding-right change)

## Files NOT to touch
- `dialog-shell.tsx` (separate task T-DIALOG-SCROLL handles verification of body-lock CSS)
- Other libs/keys hooks
- Components that don't consume this hook

## Acceptance criteria

### Path A
- [ ] JSDoc on `useScrollLock` explicitly notes:
  - Default target is `document.body` (host document)
  - No iOS Safari rubber-band guard (page can still scroll on iOS)
  - No scrollbar-gutter compensation (desktop will see layout shift)
  - For Radix/react-remove-scroll parity, opt-in flags `preventLayoutShift` / `preventIosRubberBand` are planned (follow-up)
- [ ] When `target` is omitted but the call is inside a component with a known ref, doc recommends passing `targetRef.current?.ownerDocument?.body` explicitly
- [ ] Optional: API addition `useScrollLock({ ownerDocument: trigger.current?.ownerDocument })` accepts owner doc explicitly
- [ ] MDX page in `libs/keys/docs/content/hooks/use-scroll-lock.mdx` lists the limitations prominently
- [ ] Existing tests pass

### Path B
- [ ] Same as A PLUS:
- [ ] `preventLayoutShift: true` measures scrollbar gutter (`window.innerWidth - document.documentElement.clientWidth`), applies `padding-right` to the locked element on lock, restores on release. Refcounted via existing WeakMap.
- [ ] `preventIosRubberBand: true` adds passive-false `touchmove` listener that `preventDefault`s at scroll boundaries. Refcounted.
- [ ] Tests cover both flags' on/off states

## Verification commands
```bash
cd /Users/voitz/Projects/diffgazer-workspace
pnpm --filter @diffgazer/keys test -- scroll-lock
pnpm --filter @diffgazer/keys type-check
pnpm --filter @diffgazer/keys build
pnpm --filter @diffgazer/keys build:shadcn
git diff --stat libs/keys/public/r/scroll-lock.json
```

## Notes & references
- Spec 029 §KEYS-002
- React-remove-scroll source: https://github.com/theKashey/react-remove-scroll (reference, don't copy)
- Radix `useScrollLock` source for comparison

## Non-goals
- Do not modify the refcount logic (it's correct)
- Do not modify the restore-on-unmount logic (it's correct)
- Do not wire `useScrollLock` into `DialogShell` (T-DIALOG-SCROLL verifies CSS coverage instead)
- Do not adopt `react-remove-scroll` as a dependency
