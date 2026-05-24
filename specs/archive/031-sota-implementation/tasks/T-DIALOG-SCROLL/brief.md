# Task T-DIALOG-SCROLL — Verify CSS body-lock coverage across browser targets

**Source findings:** NEW-008
**Severity:** Low-Medium (CSS-dependent locking, residual risk)
**Phase:** 2
**Blocks:** none
**Blocked by:** none

## Goal
Native `<dialog>.showModal()` does NOT lock body scroll by itself, but `libs/ui/registry/ui/shared/dialog.css:33-36` adds `body:has(dialog[open]) { overflow: hidden; scrollbar-gutter: stable; }`. This is the existing scroll lock mechanism. Verify:

1. CSS lock works across browser targets in the declared support floor (Chrome 111, Safari 16.4, Firefox 128 per T-BROWSER-DOCS — but `:has()` support is Chrome 105+, Safari 15.4+, Firefox 121+, all within floor).
2. Custom scroll roots (consumers with non-body scrolling like `html { overflow: hidden }` or scroll containers) are not handled by this CSS.
3. iOS Safari rubber-band is not prevented (touchmove still fires on `<body>`).

Decide:
- **Option A:** Document this as the supported contract — CSS-only body-lock, no JS, no custom scroll roots, no iOS rubber-band. Add docs to Dialog README/MDX.
- **Option B:** Add a fallback JS scroll-lock via `useScrollLock` from `@diffgazer/keys` (after T-SCROLL-LOCK adds opt-in flags) inside `DialogShell` for cases where CSS isn't enough.

Default to Option A. Path B is a follow-up if real consumers complain.

## Files to touch (allowlist)
- `libs/ui/registry/ui/shared/dialog.css` (verify selectors; may add JSDoc-equivalent comment block explaining the contract)
- `apps/docs/content/docs/ui/components/dialog.mdx` (document the scroll-lock contract under "Notes" or "Limitations")
- Add a test: `libs/ui/registry/ui/dialog/dialog.test.tsx` — assert body has `overflow: hidden` when dialog is open

## Files NOT to touch
- `dialog-shell.tsx` (no behavioral change in this task)
- `use-scroll-lock.ts` (separate task T-SCROLL-LOCK)
- Theme CSS (separate)

## Acceptance criteria
- [ ] Test confirms `getComputedStyle(document.body).overflow === "hidden"` when a Dialog is open
- [ ] Test confirms it reverts to original after Dialog closes
- [ ] Test verifies multiple nested dialogs leave body locked until the outermost closes
- [ ] Dialog MDX docs has a "Scroll lock" section explaining the CSS-based mechanism and its limits (custom scroll roots, iOS rubber-band)
- [ ] `dialog.css:33-36` has a comment block explaining the design choice
- [ ] All existing dialog tests pass
- [ ] `pnpm --filter @diffgazer/ui validate:registry` passes

## Verification commands
```bash
cd /Users/voitz/Projects/diffgazer-workspace
pnpm --filter @diffgazer/ui test -- dialog
pnpm --filter @diffgazer/ui type-check
pnpm --filter @diffgazer/ui validate:registry
grep -A 6 "body:has" libs/ui/registry/ui/shared/dialog.css
```

## Notes & references
- Spec 029 §NEW-008
- `:has()` browser support: Chrome 105+, Safari 15.4+, Firefox 121+ — within Tailwind v4 floor
- Reference: spec 029 corrected the original "DialogShell always leaks scroll" claim — body lock IS provided via CSS, just CSS-only with limitations

## Non-goals
- Do not implement Option B (full JS scroll lock) in this task
- Do not change native dialog behavior
- Do not add a polyfill for older Safari without `:has()` (out of support floor)
- Do not modify scroll lock for non-Dialog components
