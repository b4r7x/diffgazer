# Scopes

> Try the [Scoped Dialog demo](../../examples/playground/) to see scopes in action.

Scopes control which keyboard handlers are active at any given moment. Only handlers registered in the **active scope** receive events. Everything else is paused.

## How the scope stack works

KeyboardProvider maintains an internal stack. It starts with one entry:

```
[ global ]
```

The active scope is always the last item in the stack. When you push a new scope, it goes on top. When you pop it, the previous scope becomes active again.

```
[ global ]                    -> "global" is active
[ global, modal ]             -> "modal" is active
[ global, modal, confirm ]    -> "confirm" is active
[ global, modal ]             -> pop "confirm", back to "modal"
[ global ]                    -> pop "modal", back to "global"
```

Handlers registered in `"global"` still exist while `"modal"` is active. They just don't fire. The moment `"modal"` is popped, `"global"` handlers resume as if nothing happened.

## When to use scopes

Scopes are for **layers of UI that should capture keyboard input exclusively**:

- Modal dialogs
- Command palettes
- Confirmation overlays
- Nested drawers or panels

If you have a sidebar and a main content area that are both visible and both need keyboard shortcuts, you probably don't need scopes. Use `targetRef` and `requireFocusWithin` instead.

## useScope

```tsx
import { useScope, useKey } from "@diffgazer/keys";

function ConfirmDialog({ open }: { open: boolean }) {
  useScope("confirm", { enabled: open });

  // These register in the "confirm" scope automatically
  // because useScope made it the active scope
  useKey("Escape", onClose);
  useKey("Enter", onConfirm);

  return open ? <dialog>...</dialog> : null;
}
```

`useScope` pushes the named scope on mount (or when `enabled` becomes `true`) and pops it on unmount (or when `enabled` becomes `false`). It throws if there's no `KeyboardProvider` above it in the tree.

**Options:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enabled` | `boolean` | `true` | Whether the scope is currently pushed |

## Scope lifecycle

Here's what happens when a modal opens over a page that already has global shortcuts:

```
1. Page mounts           -> global handlers registered in "global" scope
2. Modal opens           -> useScope("modal") pushes "modal"
3. User presses Escape   -> only "modal" handlers checked
4. Modal closes          -> useScope cleanup pops "modal"
5. User presses Escape   -> "global" handlers receive it again
```

Nested overlays stack naturally. A confirmation dialog inside a modal:

```tsx
function App() {
  return (
    <KeyboardProvider>
      <Page />                    {/* registers in "global" */}
      {showModal && <Modal />}    {/* pushes "modal" */}
    </KeyboardProvider>
  );
}

function Modal() {
  useScope("modal");
  // ...
  return (
    <div>
      {showConfirm && <ConfirmDialog />}  {/* pushes "confirm" */}
    </div>
  );
}
```

Stack at peak: `[ global, modal, confirm ]`. Closing the confirm dialog pops back to `modal`. Closing the modal pops back to `global`.

## Handler priority within a scope

When multiple handlers are registered for the same hotkey in the same scope, the **last-registered handler wins**. Handlers are checked from end to start, and the first match returns immediately.

```tsx
// Inside a component that called useScope("modal"):
useScope("modal");

// Both register "Escape" in "modal" scope (the currently active scope)
useKey("Escape", handleA); // registered first
useKey("Escape", handleB); // registered second -> wins
```

If `handleB`'s component unmounts, `handleA` becomes the active handler for that hotkey again. No re-registration needed.

## Multiple components, same scope name

Each `useScope` call gets a unique internal ID. Two components can push the same scope name independently:

```tsx
function PanelA() {
  useScope("panel");
  // ...
}

function PanelB() {
  useScope("panel");
  // ...
}
```

If both are mounted, the stack looks like `[ global, panel, panel ]`. Unmounting `PanelB` removes its entry but leaves `PanelA`'s. The scope name `"panel"` stays active.

The handler map for a scope name is only deleted when **no entries** with that name remain in the stack.

## useScope vs useFocusZone scope option

`useFocusZone` accepts an optional `scope` parameter that internally calls `useScope`:

```tsx
// These are equivalent:
useScope("panel", { enabled: true });

useFocusZone({
  initial: "list",
  zones: ["list", "detail"] as const,
  scope: "panel",
});
```

The difference: `useFocusZone` only pushes the scope when `scope` is provided **and** `enabled` is `true`. If you omit `scope`, no scope is pushed at all. This is the common case -- most focus zones don't need their own scope.

Use the `scope` option on `useFocusZone` when the zone represents a distinct layer (like a command palette) rather than just a region within an existing layer.

## defaultPrevented skipping

KeyboardProvider checks `event.defaultPrevented` at the very top of its keydown handler. If some other listener already called `event.preventDefault()`, @diffgazer/keys skips the event entirely.

This matters when you have local `onKeyDown` handlers on elements:

```tsx
<input
  onKeyDown={(e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      clearInput();
    }
  }}
/>
```

With this, pressing Escape in the input will clear it but **not** trigger any @diffgazer/keys handler for Escape. The React synthetic event's `preventDefault()` sets `defaultPrevented` on the native event, and @diffgazer/keys respects that.

This is by design. If a component handles a key locally, @diffgazer/keys stays out of the way.

## Error handling

Handler errors are caught and logged. They don't crash the app or break other handlers:

```
[@diffgazer/keys] Handler error for "Escape": TypeError: Cannot read property...
```

If a handler throws, @diffgazer/keys logs the error via `console.error` and returns. Other hotkeys in the same scope continue to work normally.

## Common mistakes

**Forgetting to conditionally enable:**

```tsx
// Bug: scope is always pushed, even when dialog is closed
function Dialog({ open }: { open: boolean }) {
  useScope("dialog"); // always active
  return open ? <div>...</div> : null;
}

// Fix: tie enabled to the open state
function Dialog({ open }: { open: boolean }) {
  useScope("dialog", { enabled: open });
  return open ? <div>...</div> : null;
}
```

**Registering handlers before the scope is pushed:**

`useKey` registers in whatever scope is active at the time its effect runs. Since `useScope` pushes the scope via a state update (triggering a re-render), `useKey` calls in the same component will register in the new scope after the re-render.

However, if a parent component registers handlers *before* a child pushes a scope, those handlers stay in the parent's scope:

```tsx
function Parent() {
  useKey("Escape", handleParentEscape); // registers in "global"
  return <Modal />;
}

function Modal() {
  useScope("modal"); // pushes "modal"
  useKey("Escape", handleModalEscape); // registers in "modal"
}
```

This is usually what you want -- each component's handlers go in the scope that's active for that component.

**Handlers not firing because a lower component called preventDefault:**

If a child element's `onKeyDown` calls `preventDefault()`, @diffgazer/keys won't see the event. Check for local handlers on inputs, textareas, or custom components that might be intercepting keys before they reach the window listener.
