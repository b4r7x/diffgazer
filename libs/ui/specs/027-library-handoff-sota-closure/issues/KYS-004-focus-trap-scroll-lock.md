# KYS-004: Focus Trap, Scroll Lock, And Focusable Discovery

Priority: P1

## Problem

Focus trap and focusable discovery are not robust enough for a handoff library.

Known gaps:

- Focus trap treats selector matches as actually tabbable.
- Hidden/inert/`aria-hidden`/`display:none`/`visibility:hidden`/disabled-by-fieldset nodes can be selected as focus targets.
- `initialFocus` is trusted even if it points outside the container.
- `useFocusTrap` and `useScrollLock` depend on ref objects, not the resolved node, so they may miss `.current` changes on a stable ref.
- `libs/ui/registry/lib/focus.ts`, UI popover auto-focus, and keys focus trap duplicate focusable selectors.
- UI registry `use-scroll-lock` wrapper omits the public options type export.

Evidence:

- `libs/keys/src/hooks/use-focus-trap.ts`
- `libs/keys/src/hooks/use-scroll-lock.ts`
- `libs/keys/src/utils/navigation-items.ts`
- `libs/ui/registry/lib/focus.ts`
- `libs/ui/registry/ui/popover/use-auto-focus.ts`
- `libs/ui/registry/hooks/use-scroll-lock.ts`

## Required Fix

- Centralize focusable discovery in `@diffgazer/keys`.
- Export `getFocusableElements` and `getFirstFocusableElement` if useful to UI.
- Filter genuinely non-focusable elements.
- Guard `initialFocus` to container-owned targets.
- Make node-change behavior explicit and tested.
- Re-export `UseScrollLockOptions` from UI registry wrapper.

## Tests

Add tests for:

- hidden/inert/disabled fieldset elements skipped;
- initial focus outside container ignored or falls back correctly;
- ref `.current` node replacement cleans old listeners/locks and attaches new ones;
- UI popover and focus trap share the same focusable rules where possible.
