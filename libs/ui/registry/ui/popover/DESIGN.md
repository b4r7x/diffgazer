# Popover Design

Dual-mode floating content primitive. Click mode opens a non-modal dialog; hover mode shows a tooltip. One component handles both because the underlying behavior (anchor to trigger, position in viewport, dismiss on interaction) is the same — only the trigger mechanism and ARIA semantics differ.

Tooltip wraps Popover with `triggerMode="hover"`. This avoids duplicating positioning, animation, and dismiss logic.

## Pattern

Compound component with context. Root owns state, Trigger and Content consume it.

```
PopoverRoot (state + context provider)
├── PopoverTrigger (ARIA attrs + event handlers, render-prop support)
└── PopoverContent (portal + positioning + animation + dismiss)
```

Three files do the actual work:
- `popover.tsx` — root provider, wires `useControllableState` and `usePopoverBehavior`
- `popover-trigger.tsx` — click/hover-aware trigger with render-prop for custom elements
- `popover-content.tsx` — positioned portal with presence animation and auto-focus

`use-popover-behavior.ts` extracts all interaction logic (timers, keyboard, scroll/resize listeners) from the root. This keeps the root focused on state and context.

## State Architecture

**Approach A (no memoization).** `useControllableState` returns an unstable setter — new function reference every render. The context value is a plain object, not wrapped in `useMemo`. Behavior functions from `usePopoverBehavior` are plain functions, not wrapped in `useCallback`.

This is intentional. With only 2 context consumers (Trigger + Content), the re-render cost of a new context value is negligible. The React Compiler handles memoization better than manual attempts. Previous versions used `useCallback` + `useMemo` on top of the Approach A hook — this created dead memoization (the unstable setter broke the entire chain).

`useEffectEvent` is used for `closePopover` (scroll/resize handler) and `handleKeyDown` (keyboard handler). These are effect-only — they're called from `useEffect` bodies, never from callbacks or event handler props.

## Accessibility

**Click mode** — `role="dialog"`, non-modal. Trigger gets `aria-expanded`, `aria-haspopup="dialog"`, `aria-controls`. Content auto-focuses the first focusable child via `requestAnimationFrame`. No focus trap — WAI-ARIA non-modal dialog pattern doesn't require one.

**Hover mode** — `role="tooltip"`. Trigger gets `aria-describedby` pointing to the tooltip content. No auto-focus (tooltips are supplementary). Trigger span gets `tabIndex={0}` for keyboard discoverability.

Both modes: Escape closes and returns focus to trigger.

## Positioning

Delegates to `useFloatingPosition` — a shared hook with flip, shift, and collision detection. Position is calculated via `ResizeObserver` on trigger and content, plus scroll parent tracking. Content renders in a Portal at document.body to escape overflow clipping.

When position hasn't been calculated yet, content is rendered as `visibility: hidden` at (0, 0) to allow measurement without flash.

## Animation

`usePresence` manages the lifecycle: open → animate in → visible → close triggered → animate out → unmount. The `data-state` attribute (`open`/`closed`) drives CSS animations. Content stays in DOM during the exit animation via `onAnimationEnd` callback.

## Hover Bridge

When hovering, moving the mouse from trigger to content shouldn't close the popover. Both trigger-leave and content-leave schedule a delayed close (`scheduleClose`). Content-enter clears the pending close timer. This creates a grace period where the mouse can travel between trigger and content without dismissal.

Scroll and resize close the hover popover immediately (via `useEffectEvent` + window listeners).

## What This Doesn't Do

- **No Arrow sub-component** — Radix and Ark have these. Could be added later.
- **No focus trap** — Non-modal popovers don't trap focus per ARIA. If modal behavior is needed, use Dialog instead.
- **No `onOpenAutoFocus`/`onCloseAutoFocus`** — Consumers can use `autoFocus={false}` and manage focus manually. The content accepts `...rest` props including `aria-label`.
- **No Anchor sub-component** — Content always anchors to Trigger. No separate anchor element support.
