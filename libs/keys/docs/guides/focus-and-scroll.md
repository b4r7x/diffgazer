# Focus and Scroll

> Try the [Focus Trap demo](../../examples/playground/) to see focus trapping in action.

Two utility hooks for managing focus traps and scroll locking. Both are independent of `KeyboardProvider` and work anywhere in your component tree.

## useFocusTrap

Traps Tab focus inside a container element. Useful for modals, dialogs, and any overlay where Tab should cycle through the overlay's controls instead of escaping to the page behind it.

```tsx
import { useRef } from "react";
import { useFocusTrap } from "@diffgazer/keys";

function Modal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  useFocusTrap(containerRef, { enabled: open });

  if (!open) return null;
  return (
    <div ref={containerRef} tabIndex={-1}>
      <input placeholder="Name" />
      <button onClick={onClose}>Close</button>
    </div>
  );
}
```

### API

```ts
function useFocusTrap(
  containerRef: RefObject<HTMLElement | null>,
  options?: UseFocusTrapOptions,
): void;

interface UseFocusTrapOptions {
  initialFocus?: RefObject<HTMLElement | null>;
  restoreFocus?: boolean;   // default: true
  enabled?: boolean;        // default: true
}
```

### Independence from KeyboardProvider

`useFocusTrap` attaches its keydown listener directly on the **container element**, not on `window`. It doesn't use `KeyboardContext` at all. This means:

- It works without `KeyboardProvider` in the tree
- It doesn't interfere with @diffgazer/keys's scope system
- It doesn't care about the active scope

This separation is intentional. Focus trapping is a DOM concern. Keyboard shortcuts are an application concern. They shouldn't be coupled.

### Initial focus behavior

When the trap activates, it focuses an element in this priority order:

1. `initialFocus.current` if provided and non-null
2. First focusable element inside the container
3. The container itself (as a fallback)

```tsx
const closeRef = useRef<HTMLButtonElement>(null);

useFocusTrap(containerRef, {
  initialFocus: closeRef,
});

// Close button gets focus when the trap activates
return (
  <div ref={containerRef}>
    <input placeholder="Name" />
    <button ref={closeRef}>Close</button>
  </div>
);
```

### What counts as focusable

The exact selector:

```
a[href],
button:not([disabled]),
textarea:not([disabled]),
input:not([disabled]),
select:not([disabled]),
[tabindex]:not([tabindex="-1"])
```

Elements with `tabindex="-1"` are excluded. Disabled inputs, buttons, textareas, and selects are excluded. Links without `href` are excluded.

### Tab cycling

The trap only intercepts Tab at the **boundaries**. Regular Tab presses between focusable elements use browser-default behavior.

- `Tab` on the **last** focusable element wraps to the first
- `Shift+Tab` on the **first** focusable element wraps to the last
- Everything in between is untouched

This means you get native tab ordering for free. The trap only steps in to prevent focus from leaving the container.

### Dynamic content

Focusable elements are re-queried on every Tab press. If you conditionally render a button or input inside the trap, it's picked up immediately -- no need to notify the trap or re-initialize anything.

```tsx
<div ref={containerRef}>
  <input placeholder="Name" />
  {showExtra && <input placeholder="Email" />}  {/* just works */}
  <button>Submit</button>
</div>
```

### Focus restoration

When the trap deactivates (unmount or `enabled` becomes `false`), it restores focus to whatever element was focused before the trap activated. This is on by default.

```tsx
// User clicks a button -> modal opens -> trap captures activeElement (the button)
// User closes modal -> trap restores focus to the button

useFocusTrap(containerRef, {
  restoreFocus: false, // disable if you handle focus yourself
});
```

### The modal pattern

The three hooks you'll typically combine for a modal:

```tsx
function Modal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);

  useScope("modal", { enabled: open });
  useFocusTrap(ref, { enabled: open });
  useScrollLock(undefined, open);

  useKey("Escape", onClose);

  if (!open) return null;
  return (
    <div ref={ref} tabIndex={-1} role="dialog">
      <h2>Modal title</h2>
      <button onClick={onClose}>Close</button>
    </div>
  );
}
```

- `useScope("modal")` isolates keyboard shortcuts to the modal
- `useFocusTrap` keeps Tab inside the modal
- `useScrollLock` prevents the page from scrolling behind it

All three clean up on unmount or when `open` becomes `false`.

---

## useScrollLock

Prevents scrolling on an element by setting `overflow: hidden`. Reference-counted so multiple locks on the same element don't conflict.

```tsx
import { useScrollLock } from "@diffgazer/keys";

function Modal({ open }: { open: boolean }) {
  useScrollLock(undefined, open); // locks document.body
  return open ? <div>...</div> : null;
}
```

### API

```ts
function useScrollLock(
  target?: RefObject<HTMLElement | null>,
  enabled?: boolean,  // default: true
): void;
```

### Default target

If `target` is omitted or its `current` is `null`, the lock applies to `document.body`.

```tsx
// These are equivalent:
useScrollLock();
useScrollLock(undefined, true);

// Lock a specific scrollable container:
const panelRef = useRef<HTMLDivElement>(null);
useScrollLock(panelRef, showOverlay);
```

### Reference counting

Multiple components can lock the same element without fighting over `overflow`. The hook uses a module-level `WeakMap<Element, number>` to track lock counts.

```
Component A locks body    -> count: 1, overflow set to "hidden"
Component B locks body    -> count: 2, no style change
Component B unlocks body  -> count: 1, no style change
Component A unlocks body  -> count: 0, overflow restored to original value
```

The original `overflow` value is captured when the first lock is applied and restored when the last lock is released. This means if the element had `overflow: auto` before, it gets `overflow: auto` back -- not an empty string.

### WeakMap for cleanup

The `WeakMap` means if the element is removed from the DOM and garbage collected, its lock count goes with it. No manual cleanup, no memory leaks.

### Multiple locks example

A common case: a modal and a nested confirmation dialog both lock scroll.

```tsx
function Modal({ open }: { open: boolean }) {
  useScrollLock(undefined, open);

  return open ? (
    <div>
      <p>Modal content</p>
      {showConfirm && <ConfirmDialog />}
    </div>
  ) : null;
}

function ConfirmDialog() {
  useScrollLock(); // second lock on body

  return (
    <div>
      <p>Are you sure?</p>
      <button>Yes</button>
    </div>
  );
}
```

When `ConfirmDialog` unmounts, the body stays locked because `Modal` still has an active lock. When `Modal` unmounts, the body's overflow is restored.
