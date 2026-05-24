# Task T-MOBILE-CRITICAL — Three mobile UX blockers for touch + iOS Safari

**Source findings:** NEW-022, NEW-023, NEW-024
**Severity:** Critical (UX broken on touch + iOS < 15.4)
**Phase:** 0
**Blocks:** none
**Blocked by:** none

## Goal
Three mobile blockers. Fix all three in one task because they touch related primitives:

1. **NEW-022 Popover/Tooltip hover-mode unreachable on touch.** `popover-trigger.tsx:144-152, 222-223` renders `<span>` for non-interactive children with only `mouseenter`/`leave`/`focus`/`blur` handlers. Touch devices have no hover event → tooltip/popover invisible to touch users. `tooltip.tsx:30-38` forces `triggerMode="hover"` — same issue.
2. **NEW-023 iOS Safari persistent focus-zoom.** `input-variants.ts:4-6` `sm: text-xs (12px)`, `md: text-sm (14px)`. iOS Safari zooms on focus when computed font-size < 16px AND **does not zoom back**. Every focus permanently breaks the viewport.
3. **NEW-024 `dialog.showModal()` no feature detect.** `dialog-shell.tsx:65` throws on iOS Safari < 15.4. No fallback path.

## Files to touch (allowlist)

### NEW-022
- `libs/ui/registry/ui/popover/popover-trigger.tsx` (add touch handler to non-interactive span wrapper)
- `libs/ui/registry/ui/tooltip/tooltip.tsx` (decide: support `triggerMode="touch"` via long-press, OR document that tooltips are not for touch and provide visible alternative pattern)
- `libs/ui/registry/ui/popover/use-popover-behavior.ts` (may need touch open/close logic)
- `libs/ui/registry/ui/popover/popover.test.tsx`, `tooltip.test.tsx` (add touch-mode tests)

### NEW-023
- `libs/ui/registry/lib/input-variants.ts` (raise base font-size or add mobile media query)
- `libs/ui/registry/ui/input/input.test.tsx` (verify no layout regression on sm/md)
- Note: `text-xs` is also used by other components; only the INPUT/TEXTAREA variant needs the bump

### NEW-024
- `libs/ui/registry/ui/shared/dialog-shell.tsx` (feature-detect + fallback)
- `libs/ui/registry/ui/shared/dialog.test.tsx` if exists, or `libs/ui/registry/ui/dialog/dialog.test.tsx`

### Public registries
- Refresh via `pnpm --filter @diffgazer/ui build:shadcn` (do NOT hand-edit `libs/ui/public/r/*.json`)

## Files NOT to touch
- Other component files
- Theme CSS
- Tailwind config

## Acceptance criteria

### NEW-022
- [ ] Popover hover-mode with non-interactive child responds to tap (opens on tap-down, closes on outside tap or second tap)
- [ ] Tooltip is reachable on touch — either via long-press (300-500ms) OR by switching to `aria-describedby` static visible behavior on touch devices
- [ ] Tests cover: touch tap-open, second-tap-close, outside-tap-close
- [ ] No regression on desktop hover behavior

### NEW-023
- [ ] Input/Textarea at `sm` and `md` variants render with computed font-size ≥ 16px **on viewports ≤ 768px wide** (use `@media (max-width: 768px)` or media query inside `input-variants.ts` class strings)
- [ ] Desktop (>768px) `sm`/`md` remain visually compact (12-14px is OK there)
- [ ] Existing input tests pass
- [ ] iOS Safari focus-zoom does not trigger (manual verification step documented in report)

### NEW-024
- [ ] `dialog-shell.tsx` feature-detects `"showModal" in HTMLDialogElement.prototype`
- [ ] If `showModal` unavailable, falls back to a `<div role="dialog" aria-modal="true">` with manual focus trap (via `useFocusTrap` from `@diffgazer/keys`) + scroll lock + escape handler + inert background
- [ ] No throw on iOS Safari < 15.4
- [ ] All existing dialog tests pass
- [ ] New test: when `HTMLDialogElement.prototype.showModal` is mocked-deleted, fallback renders correctly

### General
- [ ] Public registries regenerated for changed components
- [ ] No public API change (consumer code keeps working without modification)

## Verification commands
```bash
cd /Users/voitz/Projects/diffgazer-workspace
pnpm --filter @diffgazer/ui test -- popover tooltip input textarea dialog
pnpm --filter @diffgazer/ui type-check
pnpm --filter @diffgazer/ui validate:registry
pnpm --filter @diffgazer/ui build:shadcn
git diff --stat libs/ui/public/r/popover.json libs/ui/public/r/tooltip.json libs/ui/public/r/input.json libs/ui/public/r/dialog.json libs/ui/public/r/dialog-shell.json 2>/dev/null
```

## Notes & references
- Spec 029 §NEW-022/023/024
- WAI-ARIA APG tooltip pattern: tooltip on touch requires alternative discoverability (long-press, persistent label, etc.). Reasonable choices: (a) long-press popover, (b) auto-disable hover-mode on touch and require explicit interactive trigger, (c) document the limitation and provide an alternative slot.
- iOS Safari zoom rule: font-size < 16px on focused inputs triggers zoom-to-fit, and does NOT zoom back when blurred. Source: WebKit bug 60125.
- Feature detect pattern: `if ('showModal' in HTMLDialogElement.prototype)` is the standard.
- `useFocusTrap` is improved/preserved separately in T-FOCUS-TRAP (Phase 2); this task uses the current implementation. If that hook ships boundary-cycling semantics, document the trade-off in the fallback path.

## Non-goals
- Do not address NEW-005 (scroll-parent walker) — separate task.
- Do not introduce gesture libraries (no react-use-gesture, no framer-motion).
- Do not modify the `aria-describedby`/`aria-labelledby` ARIA wiring (already correct).
- Do not change tablet vs phone targeting — `@media (max-width: 768px)` is the convention.

## Design hints (non-binding)

### NEW-022 long-press touch
```ts
// In popover-trigger.tsx for non-interactive span:
onPointerDown: (e) => {
  if (e.pointerType === "touch") {
    // start 400ms timer; on timeout, open popover
    // cancel on pointermove/pointerup
  }
}
```

### NEW-023 input variants
```ts
// input-variants.ts
sm: "h-7 px-2 text-xs max-md:text-base", // mobile bumps to 16px
md: "h-9 px-3 text-sm max-md:text-base",
lg: "h-11 px-4 text-base",
```
(`max-md:` is the Tailwind v4 variant for `@media (max-width: 768px)`.)

### NEW-024 dialog fallback
```tsx
// dialog-shell.tsx
const supportsShowModal = typeof HTMLDialogElement !== "undefined"
  && "showModal" in HTMLDialogElement.prototype;
if (supportsShowModal) {
  // existing native dialog path
} else {
  // fallback: <div role="dialog" aria-modal="true"> + useFocusTrap + useScrollLock + escape + inert background
}
```
