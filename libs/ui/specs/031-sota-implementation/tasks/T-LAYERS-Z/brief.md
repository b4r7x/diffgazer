# Task T-LAYERS-Z — Declare @layer order + expose z-index tokens

**Source findings:** NEW-034
**Severity:** Medium
**Phase:** 4
**Blocks:** none
**Blocked by:** none

## Goal
- `@layer theme, base, components, utilities;` is NOT declared anywhere → consumer override behavior depends on source order, fragile.
- No public z-index token scale — `z-50` (toast), `z-9999` (popover/select/tooltip), `z-10` (CardLabel) are ad-hoc.

## Files to touch (allowlist)
- `libs/ui/styles/theme-base.css` (add explicit layer order at TOP)
- `libs/ui/styles/theme.css` (or add to `@theme` block — z-index tokens)
- `libs/ui/registry/ui/popover/popover-content.tsx` (use `--z-popover` token)
- `libs/ui/registry/ui/select/select-content.tsx` (use `--z-popover` token)
- `libs/ui/registry/ui/tooltip/tooltip-content.tsx` (use `--z-popover` token)
- `libs/ui/registry/ui/toast/toast-container.tsx` (use `--z-toast` token)
- Other components with `z-` (search and update)
- Regenerated public registry items for all touched files

## Files NOT to touch
- Native `<dialog>` (browser top-layer, no z-index)
- Theme tokens unrelated to z-index

## Acceptance criteria
- [ ] `theme-base.css` first line declares `@layer theme, base, components, utilities;`
- [ ] `@theme` block has `--z-base: 1`, `--z-dropdown: 100`, `--z-overlay: 200`, `--z-popover: 300`, `--z-toast: 400` (or similar scale — pick semantically and document)
- [ ] Components use `z-[var(--z-popover)]` (or Tailwind `z-popover` if you wire up the variant) instead of `z-9999`
- [ ] Documentation note in `apps/docs/content/docs/ui/index.mdx` or `theme.mdx` explaining native dialog is above all z-index (top-layer)
- [ ] Tests still pass
- [ ] No visual regression

## Verification commands
```bash
cd /Users/voitz/Projects/diffgazer-workspace
pnpm --filter @diffgazer/ui test
pnpm --filter @diffgazer/ui type-check
pnpm --filter @diffgazer/ui build:shadcn
pnpm --filter @diffgazer/ui validate:registry
grep -r "z-9999\|z-50\b" libs/ui/registry/ui/ | head -10
# All should be replaced or have a clear reason to remain
```

## Notes & references
- Spec 029 §NEW-034
- Tailwind v4 layer system: https://tailwindcss.com/docs/adding-custom-styles#cascade-layers

## Non-goals
- Do not address top-layer / Popover API (separate T-TOAST-OVER-DIALOG)
- Do not change positioning logic
- Do not introduce JS z-index management
