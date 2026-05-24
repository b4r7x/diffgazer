# Task T-REDUCED-MOTION — Token-based reduced-motion fix + per-component cleanup

**Source findings:** UI-002, NEW-011
**Severity:** High (a11y; WCAG 2.3.3 expectation)
**Phase:** 2
**Blocks:** none
**Blocked by:** none

## Goal
Surfaces that ignore `prefers-reduced-motion: reduce`:
- `libs/ui/registry/ui/popover/popover-content.tsx:171-172` — hardcoded `animate-[slide-in_0.15s_ease-out]` / `slide-out`
- `libs/ui/registry/ui/select/select-content.tsx:266-267` — `animate-slide-in` / `animate-slide-out`
- `libs/ui/registry/ui/accordion/accordion-content.tsx:20` — `transition-[grid-template-rows] duration-200`
- `libs/ui/registry/ui/stepper/stepper-content.tsx:19` — same
- `libs/ui/registry/ui/select/select-item.tsx:147` — `animate-pulse`
- `libs/ui/registry/ui/stepper/stepper-substep.tsx:21` — `animate-pulse`
- `libs/ui/registry/ui/shared/dialog.css:62` — `animation-duration: 0.01s !important` (shorten, not disable)

SOTA fix: add a `@media (prefers-reduced-motion: reduce)` block in `libs/ui/styles/theme-base.css` that sets every `--animate-*` token to `none`. Tailwind v4 compiles `animate-slide-in` to `animation: var(--animate-slide-in)`, so the token override neutralizes every consumer (Popover, Select, Toast, future surfaces) without retrofitting `motion-safe:` everywhere. Plus per-component fixes for the 4 sites that use non-token animations.

## Files to touch (allowlist)
- `libs/ui/styles/theme-base.css` (add `@media (prefers-reduced-motion: reduce)` block neutralizing every `--animate-*` token)
- `libs/ui/registry/ui/accordion/accordion-content.tsx` (add `motion-reduce:transition-none` to grid transition)
- `libs/ui/registry/ui/stepper/stepper-content.tsx` (same)
- `libs/ui/registry/ui/select/select-item.tsx:147` (change `animate-pulse` → `motion-safe:animate-pulse`)
- `libs/ui/registry/ui/stepper/stepper-substep.tsx:21` (same)
- `libs/ui/registry/ui/shared/dialog.css:62` (change `animation-duration: 0.01s !important` → `animation: none !important`)
- Regenerated public registries: `libs/ui/public/r/{theme,dialog-shell,accordion,stepper,select}.json`
- Add tests: `libs/ui/registry/ui/{popover,select,accordion,stepper,dialog}/*.test.tsx` with `matchMedia` mocked to `prefers-reduced-motion: reduce`

## Files NOT to touch
- Toast (already correct — uses `motion-safe:` prefix)
- Spinner (already correct — JS-based, respects matchMedia)
- Tabs (already has `motion-reduce:transition-none`)
- Other components without animations

## Acceptance criteria
- [ ] `theme-base.css` has a `@media (prefers-reduced-motion: reduce)` block at `:root` that sets `--animate-slide-in`, `--animate-slide-out`, `--animate-fade-in`, `--animate-fade-out`, and every other `--animate-*` token to `none`
- [ ] `accordion-content` grid transition disabled under reduced-motion (`motion-reduce:transition-none` class)
- [ ] `stepper-content` same
- [ ] `select-item` `animate-pulse` → `motion-safe:animate-pulse` (so it only runs when motion is allowed)
- [ ] `stepper-substep` same
- [ ] `dialog.css:62` uses `animation: none !important` (NOT `animation-duration: 0.01s !important`)
- [ ] Tests render each affected component with `matchMedia` mocked to `prefers-reduced-motion: reduce` and assert computed `animation`/`transition` is `none` (or `transition-duration` is 0)
- [ ] All existing tests pass
- [ ] No visual regression for users WITHOUT reduced-motion preference
- [ ] `pnpm --filter @diffgazer/ui validate:registry` passes

## Verification commands
```bash
cd /Users/voitz/Projects/diffgazer-workspace
pnpm --filter @diffgazer/ui test -- popover select accordion stepper dialog
pnpm --filter @diffgazer/ui type-check
pnpm --filter @diffgazer/ui build:shadcn
git diff --stat libs/ui/public/r/theme.json libs/ui/public/r/accordion.json libs/ui/public/r/stepper.json libs/ui/public/r/dialog-shell.json libs/ui/public/r/select.json
# Spot-check the reduced-motion @media block exists
grep -A 20 "prefers-reduced-motion" libs/ui/styles/theme-base.css | head -25
```

## Notes & references
- Spec 029 §UI-002, NEW-011
- Tailwind v4 token-to-property compilation: `animate-<key>` compiles to `animation: var(--animate-<key>)`. Overriding the var under `@media` is correct and works.
- WCAG 2.3.3 Animation from Interactions (AAA): "Motion animation triggered by interaction can be disabled."
- `motion-safe:` and `motion-reduce:` are Tailwind v4 variants for `@media (prefers-reduced-motion: no-preference)` and `(reduce)` respectively.

## Non-goals
- Do not remove animations entirely (only neutralize under reduced-motion)
- Do not add new animation tokens or change durations for non-reduced-motion case
- Do not refactor CSS architecture (separate task T-LAYERS-Z)
- Do not add a JS-based `useReducedMotion` hook (CSS handles it correctly)

## Implementation snippet

```css
/* libs/ui/styles/theme-base.css */
@media (prefers-reduced-motion: reduce) {
  :root {
    --animate-slide-in: none;
    --animate-slide-out: none;
    --animate-fade-in: none;
    --animate-fade-out: none;
    --animate-pulse: none;
    /* ...every --animate-* token defined elsewhere in this file */
  }
}
```

Test pattern:

```tsx
beforeEach(() => {
  window.matchMedia = vi.fn().mockImplementation((q) => ({
    matches: q === "(prefers-reduced-motion: reduce)",
    media: q, addEventListener: vi.fn(), removeEventListener: vi.fn(),
    addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: vi.fn(),
  })); // Boundary mock: jsdom doesn't implement matchMedia
});

it("Popover content has no animation under reduced-motion", async () => {
  // ... render open Popover
  const content = await screen.findByRole("dialog");
  const computed = getComputedStyle(content);
  expect(computed.animation).toBe("none");
});
```
