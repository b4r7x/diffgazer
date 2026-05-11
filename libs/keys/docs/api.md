# API Reference

> See the [interactive playground](../examples/playground/) for live demos of each hook.

Complete reference for all public exports from `@diffgazer/keys`. Requires React 19+.

---

## KeyboardProvider

Context provider that enables scoped keyboard handling. Wraps your app (or a subtree) and listens for `keydown` events on `window`.

```tsx
import { KeyboardProvider } from "@diffgazer/keys";

function App() {
  return (
    <KeyboardProvider>
      <YourApp />
    </KeyboardProvider>
  );
}
```

### Props

| Prop | Type | Description |
|------|------|-------------|
| `children` | `ReactNode` | Required. Child elements. |

### Behavior

- Creates a `"global"` scope on mount. All handlers registered without a scope push land here.
- Maintains a scope stack. Declarative scopes follow React tree order, imperative `pushScope` calls sit above declarative scopes, and only handlers in the active scope fire.
- Skips events where `event.defaultPrevented` is already `true`.
- Skips handlers for text-editable targets (text-like `input`, `textarea`, and editable content) unless `allowInInput` is set. Non-text controls such as `select`, checkbox, radio, range, and button inputs are allowed by default.
- When a handler specifies `containerRef` + `focusWithinOnly`, only fires if the event target is inside that container.
- Handler priority: iterates entries from **last-registered to first**. The first match wins -- no subsequent handlers fire.
- Errors in handlers are caught and logged: `[@diffgazer/keys] Handler error for "${hotkey}": ...`
- When `preventDefault` is set on a handler's options, `event.preventDefault()` is called before the handler runs.

---

## useKey

The primary hook for binding keyboard shortcuts. Three overloads cover single keys, key arrays, and key maps.

```ts
import { useKey } from "@diffgazer/keys";
```

### Signatures

```ts
// Single key
function useKey(hotkey: string, handler: KeyHandler, options?: UseKeyOptions): void;

// Multiple keys, same handler
function useKey(hotkeys: readonly string[], handler: KeyHandler, options?: UseKeyOptions): void;

// Key map (different handler per key)
function useKey(handlers: Record<string, KeyHandler>, options?: UseKeyOptions): void;
```

```ts
type KeyHandler = (event: KeyboardEvent) => void;
```

### UseKeyOptions

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enabled` | `boolean` | `true` | Toggle registration on/off. |
| `scope` | `string \| null` | inferred scope | Register in an explicit scope. Pass `null` to skip registration. |
| `allowInInput` | `boolean` | `false` | Fire even when focus is in a text-editable input, textarea, or editable content. |
| `containerRef` | `RefObject<HTMLElement \| null>` | -- | Restrict handler to events within this element. Requires `focusWithinOnly`. |
| `focusWithinOnly` | `boolean` | `false` | Only fire when the event target is inside `containerRef`. |
| `preventDefault` | `boolean` | `false` | Call `event.preventDefault()` before the handler runs. |

### Examples

```tsx
// Single shortcut
useKey("mod+k", (e) => openSearch());

// Multiple keys, one handler
useKey(["ArrowUp", "ArrowDown"], (e) => navigate(e.key));

// Key map
useKey({
  Enter: (e) => confirm(),
  Escape: (e) => cancel(),
});

// Scoped to a container
const ref = useRef<HTMLDivElement>(null);
useKey("Enter", handleSelect, {
  containerRef: ref,
  focusWithinOnly: true,
});
```

### Behavior

- Uses `useOptionalKeyboardContext()` internally -- if no `KeyboardProvider` is present, the hook is a **silent no-op** (no error thrown).
- Handlers use stable callback/ref patterns to avoid stale closures.
- Registers in whatever scope is active at the time of mount/re-enable.
- Cleanup on unmount deregisters all keys.

---

## Hotkey Format

Hotkeys are strings like `"mod+k"`, `"shift+Enter"`, or `"ArrowDown"`. Parsed by `matchesHotkey()` internally.

### Modifiers

Joined with `+`. The **last** segment is the key, everything before it is a modifier.

| Modifier | Maps to |
|----------|---------|
| `mod` | `Meta` on Mac, `Ctrl` elsewhere |
| `ctrl` | `Ctrl` |
| `shift` | `Shift` |
| `alt` | `Alt` |
| `meta` | `Meta` |

### Key Aliases

| Alias | Resolved to |
|-------|-------------|
| `up` | `ArrowUp` |
| `down` | `ArrowDown` |
| `left` | `ArrowLeft` |
| `right` | `ArrowRight` |
| `esc` | `Escape` |
| `space` | ` ` (space character) |

### Special Rules

- **Uppercase single letter implies Shift**: `"G"` is equivalent to `"shift+g"`.
- **Case-insensitive**: both the hotkey string and `event.key` are lowercased before comparison.
- **Strict modifier matching**: all four modifier keys (`ctrl`, `shift`, `alt`, `meta`) must match exactly. Pressing `Ctrl+Shift+K` will not match `"mod+k"` -- it would match `"mod+shift+k"`.
- **Platform detection**: `mod` resolves via `navigator.userAgent` (cached after first check).

---

## useScope

Pushes a named scope onto the stack. While active, only handlers in that scope fire. Pass `null` to skip pushing without changing render order.

```ts
import { useScope } from "@diffgazer/keys";
```

### Signature

```ts
function useScope(name: string | null, options?: { enabled?: boolean }): string | null;
```

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enabled` | `boolean` | `true` | When `false`, the scope is not pushed. |

### Example

```tsx
function Modal() {
  useScope("modal");

  useKey("Escape", () => close());

  return <div>...</div>;
}

// Conditional scope without remounting the component
function Panel({ isolate }: { isolate: boolean }) {
  useScope(isolate ? "panel" : null);
  return <div>...</div>;
}
```

### Behavior

- **Requires** `KeyboardProvider`. Throws `"useKeyboardContext must be used within KeyboardProvider"` if missing.
- Passing `null` for `name` is equivalent to `enabled: false` -- no scope is pushed, but call ordering is preserved so the hook can still toggle on later renders without violating Hook rules.
- Each call gets a unique ID -- multiple components can push the same scope name independently.
- On unmount or `enabled: false` or `name === null`, the scope is popped. If no entries with that scope name remain on the stack, the handler map for that scope is deleted.

---

## useNavigation

Standalone keyboard navigation for role-based lists, menus, tabs, and selectable groups. Returns an `onKeyDown` handler you attach to your container — no `KeyboardProvider` required.

```ts
import { useNavigation } from "@diffgazer/keys";
```

### Signature

```ts
function useNavigation(options: UseNavigationOptions): UseNavigationReturn;
```

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `containerRef` | `RefObject<HTMLElement \| null>` | -- | **Required.** Container element to query items from. |
| `role` | `NavigationRole` | -- | **Required.** ARIA role used to select items. |
| `highlighted` | `string \| null` | -- | Controlled highlighted value. |
| `onHighlightChange` | `(value: string) => void` | -- | Called when highlighted value changes. |
| `onSelect` | `(value: string, event: KeyboardEvent) => void` | -- | Called on `Space`. |
| `onEnter` | `(value: string, event: KeyboardEvent) => void` | -- | Called on `Enter`. Falls back to `onSelect` if not provided. |
| `wrap` | `boolean` | `true` | Wrap around at list boundaries. |
| `enabled` | `boolean` | `true` | Toggle navigation on/off. |
| `preventDefault` | `boolean` | `true` | Prevent default on handled keys. |
| `onNavigationBoundaryReached` | `(direction: "previous" \| "next", event: KeyboardEvent, key: string) => void` | -- | Called when `wrap` is `false` and navigation hits an edge. |
| `defaultHighlighted` | `string \| null` | `null` | Initial focused value (uncontrolled mode). |
| `orientation` | `"vertical" \| "horizontal"` | `"vertical"` | Determines default up/down keys. |
| `skipDisabled` | `boolean` | `true` | Skip items with `aria-disabled="true"`. |
| `moveFocus` | `boolean` | `false` | Move DOM focus to the next item on navigation. |
| `scopeToContainer` | `boolean` | `true` | Exclude items owned by nested collection containers. |
| `ownerSelector` | `string \| null` | role-based | Advanced override for the owner selector used when scoping nested collections. |
| `upKeys` | `string[]` | `["ArrowUp"]` / `["ArrowLeft"]` | Keys for previous item. Defaults depend on `orientation`. |
| `downKeys` | `string[]` | `["ArrowDown"]` / `["ArrowRight"]` | Keys for next item. Defaults depend on `orientation`. |

### Return

| Property | Type | Description |
|----------|------|-------------|
| `highlighted` | `string \| null` | Currently highlighted item's value. |
| `isHighlighted` | `(value: string) => boolean` | Check if a specific value is highlighted. |
| `highlight` | `(value: string) => void` | Programmatically highlight a value. |
| `onKeyDown` | `(event: KeyboardEvent) => void` | Attach to your container's `onKeyDown`. |

### NavigationRole

```ts
type NavigationRole = "radio" | "checkbox" | "option" | "menuitem" | "menuitemcheckbox" | "menuitemradio" | "button" | "tab";
```

### Example

```tsx
const ref = useRef<HTMLDivElement>(null);
const { highlighted, isHighlighted, onKeyDown } = useNavigation({
  containerRef: ref,
  role: "option",
  onSelect: (value) => select(value),
});
return <div ref={ref} onKeyDown={onKeyDown}>...</div>;

// Tab navigation
const tabRef = useRef<HTMLDivElement>(null);
const { onKeyDown: tabKeyDown } = useNavigation({
  containerRef: tabRef,
  role: "tab",
  orientation: "horizontal",
});
return (
  <div ref={tabRef} role="tablist" onKeyDown={tabKeyDown}>
    <button role="tab" data-value="one">One</button>
    <button role="tab" data-value="two">Two</button>
  </div>
);
```

### Behavior

- Standalone — does not require `KeyboardProvider`. Attach the returned `onKeyDown` to your container.
- Items are queried from the DOM using the matching ARIA role or `data-diffgazer-navigation-item` data contract.
- Items **must** have a `data-value` attribute.
- Nested collection owners are scoped out by default. Pass `scopeToContainer={false}` only when parent navigation should intentionally include nested collections.
- `scrollIntoView({ block: "nearest" })` is called on focus changes.
- Key bindings: `upKeys`, `downKeys`, `Home`, `End`, `Enter` (calls `onEnter`), `Space` (calls `onSelect`).
- Supports controlled mode via `highlighted` + `onHighlightChange`.
- For tab navigation, use `role: "tab"` with `orientation: "horizontal"`.

---

## useScopedNavigation

Scope-aware keyboard navigation — registers keys via `KeyboardProvider` using `useKey` internally. Use when you need navigation that participates in @diffgazer/keys's scope system (e.g., modals, panels).

```ts
import { useScopedNavigation } from "@diffgazer/keys";
```

### Signature

```ts
function useScopedNavigation(options: UseScopedNavigationOptions): UseScopedNavigationReturn;
```

### Options

Accepts all the same options as `useNavigation`, plus:

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `scope` | `string \| null` | active scope | Register navigation keys in an explicit keyboard scope. Pass `null` to skip registration for disabled conditional scopes. |
| `containerRef` | `RefObject<HTMLElement \| null>` | -- | Required DOM container used for navigation and focus checks. |
| `focusWithinOnly` | `boolean` | `false` | Only handle keys when focus is inside `containerRef`. |

### Return

| Property | Type | Description |
|----------|------|-------------|
| `highlighted` | `string \| null` | Currently highlighted item's value. |
| `isHighlighted` | `(value: string) => boolean` | Check if a specific value is highlighted. |
| `highlight` | `(value: string) => void` | Programmatically highlight a value. |

> **Note:** Unlike `useNavigation`, `useScopedNavigation` does **not** return an `onKeyDown` handler — keys are registered automatically through the provider.

### Example

```tsx
const ref = useRef<HTMLDivElement>(null);
const { highlighted, isHighlighted } = useScopedNavigation({
  containerRef: ref,
  role: "option",
  onSelect: (value) => select(value),
  focusWithinOnly: true,
});
```

### Behavior

- **Requires** a `<KeyboardProvider>` ancestor.
- Keys are registered via `useKey`, so they participate in the scope stack.
- Uses `useNavigationCore` internally for shared navigation logic with `useNavigation`.
- Same DOM querying and focus tracking as `useNavigation`.

---

## useFocusZone

Manages keyboard-driven focus zones for multi-panel layouts. Tracks which zone is active and provides helpers to scope key bindings per zone.

```ts
import { useFocusZone } from "@diffgazer/keys";
```

### Signature

```ts
function useFocusZone<T extends string>(options: UseFocusZoneOptions<T>): UseFocusZoneReturn<T>;
```

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `initial` | `T` | -- | **Required.** Initial active zone. |
| `zones` | `readonly T[]` | -- | **Required.** All valid zone names. |
| `zone` | `T` | -- | Controlled mode. Externally-driven active zone. |
| `onZoneChange` | `(zone: T) => void` | -- | Called after a zone transition. |
| `onLeaveZone` | `(zone: T) => void` | -- | Called with the **current** zone before leaving it. |
| `onEnterZone` | `(zone: T) => void` | -- | Called with the **next** zone when entering it. |
| `transitions` | `(params: { zone: T; key: ArrowKey }) => T \| null` | -- | Maps arrow keys to zone transitions. Return `null` to ignore. |
| `tabCycle` | `readonly T[]` | -- | Zone order for Tab/Shift+Tab cycling. |
| `scope` | `string \| null` | -- | If provided, pushes this scope while the hook is active. Pass `null` to skip scope registration. |
| `containerRef` | `RefObject<HTMLElement \| null>` | -- | Optional DOM subtree used to scope registered focus-zone keys. |
| `focusWithinOnly` | `boolean` | `false` | Only run focus-zone keys when focus is inside `containerRef`. |
| `allowInInput` | `boolean` | `false` | Allow focus-zone keys while a text-editable input, textarea, or editable content has focus. |
| `preventDefault` | `boolean` | `false` | Inherited `preventDefault` behavior for transition keys and `getKeyOptions`. |
| `enabled` | `boolean` | `true` | Toggle the entire hook on/off. |
| `focus` | `{ targets: Partial<Record<T, FocusZoneTarget>>; autoFocus?: boolean; preventScroll?: boolean }` | -- | Optional DOM focus targets for zone changes. A target may be a ref/function, or a `{ container, target }` pair that skips focus repair while focus is already inside the container. Initial mount does not focus unless `autoFocus` is true. |

### Return

| Property | Type | Description |
|----------|------|-------------|
| `zone` | `T` | Currently active zone. |
| `setZone` | `(zone: T) => void` | Manually change the active zone. |
| `isZone` | `(...zones: T[]) => boolean` | Check if active zone matches any of the given zones. |
| `getKeyOptions` | `(zone: T, extra?: UseKeyOptions) => UseKeyOptions` | Returns options that enable a key binding only when the specified zone is active. |
| `getZoneProps` | `(zone: T) => { "data-focused": true \| undefined }` | Returns DOM attributes for active-zone styling. |

### Example

```tsx
type Zone = "sidebar" | "content" | "preview";

const { zone, getKeyOptions, isZone } = useFocusZone<Zone>({
  initial: "sidebar",
  zones: ["sidebar", "content", "preview"],
  tabCycle: ["sidebar", "content", "preview"],
  transitions: ({ zone, key }) => {
    if (zone === "sidebar" && key === "ArrowRight") return "content";
    if (zone === "content" && key === "ArrowLeft") return "sidebar";
    if (zone === "content" && key === "ArrowRight") return "preview";
    return null;
  },
});

// Scope bindings to a zone
useKey("Enter", handleSelect, getKeyOptions("content"));
useKey("Escape", closeSidebar, getKeyOptions("sidebar"));
```

### Behavior

- `getKeyOptions("content", extra)` returns `{ ...extra, enabled: zone === "content" && (extra?.enabled ?? true) }`. This is the primary way to scope `useKey` calls to a zone.
- Lifecycle callback order on zone change: `onLeaveZone(current)` -> `onEnterZone(next)` -> `onZoneChange(next)`.
- Setting the same zone is a no-op -- no callbacks fire.
- If `initial` is not in `zones`, falls back to `zones[0]`.
- Supports controlled mode via the `zone` prop -- internal state is bypassed, but `onZoneChange` still fires.
- Arrow keys are registered via `useKey` only when `transitions` is provided.
- Tab/Shift+Tab are registered with `preventDefault: true` only when `tabCycle` is provided.
- Scope is pushed via `useScope` only when the `scope` option is provided.

---

## useFocusTrap

Traps Tab/Shift+Tab focus within a container element. Independent of `KeyboardProvider` -- attaches a listener directly on the container.

```ts
import { useFocusTrap } from "@diffgazer/keys";
```

### Signature

```ts
function useFocusTrap(
  containerRef: RefObject<HTMLElement | null>,
  options?: UseFocusTrapOptions,
): void;
```

### UseFocusTrapOptions

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `initialFocus` | `RefObject<HTMLElement \| null>` | -- | Element to focus on mount. |
| `restoreFocus` | `boolean` | `true` | Restore focus to the previously focused element on unmount. |
| `enabled` | `boolean` | `true` | Toggle the trap on/off. |

### Example

```tsx
function Dialog() {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useFocusTrap(dialogRef, { initialFocus: closeRef });

  return (
    <div ref={dialogRef} tabIndex={-1}>
      <p>Dialog content</p>
      <button ref={closeRef}>Close</button>
    </div>
  );
}
```

### Behavior

- Initial focus priority: `initialFocus.current` -> first focusable element -> container itself.
- Focusable elements use the shared navigation helper: links/areas with `href`, enabled form controls, media/embed elements, contenteditable elements, `details > summary:first-of-type`, and `[tabindex]:not([disabled])`. Negative `tabIndex` elements are focusable for programmatic focus but excluded from Tab order.
- Only intercepts Tab at boundaries (first/last tabbable element). Tabs between middle elements are browser-default.
- Re-queries tabbable elements on each Tab press, so dynamic content is supported.
- Captures `document.activeElement` on mount and restores it on cleanup when `restoreFocus` is `true`.
- Listener is on the **container element**, not `window`. Does not interact with `KeyboardProvider` at all.

---

## useScrollLock

Prevents scrolling on an element by setting `overflow: hidden`. Reference-counted so multiple locks on the same element work correctly.

```ts
import { useScrollLock } from "@diffgazer/keys";
```

### Signature

```ts
interface UseScrollLockOptions {
  target?: RefObject<HTMLElement | null>;
  enabled?: boolean;
}

function useScrollLock(options?: UseScrollLockOptions): void;
```

### Options

| Option | Type | Default | Description |
|-----------|------|---------|-------------|
| `target` | `RefObject<HTMLElement \| null>` | `document.body` | Element to lock. |
| `enabled` | `boolean` | `true` | Toggle the lock on/off. |

### Example

```tsx
// Lock body scroll
useScrollLock();

// Lock a specific element, conditionally
const panelRef = useRef<HTMLDivElement>(null);
useScrollLock({ target: panelRef, enabled: isOpen });
```

### Behavior

- Uses a module-level `WeakMap<Element, number>` for reference counting. First lock sets `overflow: hidden`; subsequent locks only increment the count.
- Last unlock restores the original `overflow` value.
- `WeakMap` prevents memory leaks -- elements are garbage collected normally.

---

## Navigation Item Utilities

DOM helpers shared by `useNavigation` and composite widgets. Use these when building a keyboard-aware primitive that needs the same item discovery contract as `@diffgazer/keys`.

```ts
import {
  NAVIGATION_ITEM_ATTRIBUTE,
  getNavigationItemProps,
  getNavigationItems,
  containsActiveElement,
  findNavigationItemByValue,
  focusNavigationItem,
  getFocusedNavigationValue,
  getFirstFocusableElement,
  getFocusableElements,
  getTabbableElements,
  getVerticalArrowDirection,
  isFocusable,
  toVerticalBoundaryDirection,
} from "@diffgazer/keys";
```

### Signatures

```ts
const NAVIGATION_ITEM_ATTRIBUTE = "data-diffgazer-navigation-item";

type NavigationItemType =
  | "radio"
  | "checkbox"
  | "option"
  | "menuitem"
  | "menuitemcheckbox"
  | "menuitemradio"
  | "button"
  | "tab";

interface NavigationItemQuery {
  type: NavigationItemType;
  skipDisabled?: boolean;
  scopeToContainer?: boolean;
  ownerSelector?: string | null;
}

function getNavigationItemProps(
  type: NavigationItemType,
  value: string,
): {
  "data-diffgazer-navigation-item": NavigationItemType;
  "data-value": string;
};

function getNavigationItems(
  container: HTMLElement | null,
  query: NavigationItemQuery,
): HTMLElement[];

function containsActiveElement(element: HTMLElement): boolean;

function findNavigationItemByValue(
  container: HTMLElement | null,
  query: NavigationItemQuery & { value: string },
): HTMLElement | null;

function focusNavigationItem(
  container: HTMLElement | null,
  query: NavigationItemQuery & {
    value: string;
    fallback?: "first" | "last" | "none";
    preventScroll?: boolean;
  },
): string | null;

function getFocusedNavigationValue(
  container: HTMLElement | null,
  query: NavigationItemQuery,
): string | null;

function getFocusableElements(container: HTMLElement | null): HTMLElement[];
function getFirstFocusableElement(container: HTMLElement | null): HTMLElement | null;
function getTabbableElements(container: HTMLElement | null): HTMLElement[];
function isFocusable(element: HTMLElement | null): boolean;

type VerticalDirection = "up" | "down";
type BoundaryDirection = "previous" | "next";

function getVerticalArrowDirection(key: string): VerticalDirection | null;

function toVerticalBoundaryDirection(direction: BoundaryDirection): VerticalDirection;
function toVerticalBoundaryDirection(direction: BoundaryDirection, key: string): VerticalDirection | null;
```

### Example

```tsx
function PrimitiveOption({ value, children }: { value: string; children: ReactNode }) {
  return (
    <button type="button" {...getNavigationItemProps("option", value)}>
      {children}
    </button>
  );
}
```

### Behavior

- The public data contract is `data-diffgazer-navigation-item` plus a stable `data-value`.
- `getNavigationItems()` also supports matching ARIA roles and native radio/checkbox/button controls.
- `containsActiveElement()` is useful when a composite widget needs to know whether DOM focus is inside an item.
- Typed data-contract markers only match their requested type, so an option query does not pick up radio items in the same subtree.
- Disabled items are skipped by default when they use `aria-disabled="true"`, `data-disabled`, or native `disabled`.
- Nested collection owners are scoped out by default. Pass `scopeToContainer: false` or an explicit `ownerSelector` only when parent navigation should intentionally include nested items.
- `getVerticalArrowDirection()` and `toVerticalBoundaryDirection()` bridge raw ArrowUp/ArrowDown events with orientation-neutral boundary callbacks.

---

## useFocusRestore

React hook for capturing and restoring focus around overlays, panels, command palettes, and triggerless temporary UI.

```ts
import { useFocusRestore } from "@diffgazer/keys";
```

### Signatures

```ts
interface RestoreFocusOptions {
  preventScroll?: boolean;
}

interface UseFocusRestoreOptions extends RestoreFocusOptions {
  enabled?: boolean;
  restoreOnUnmount?: boolean;
  fallback?: HTMLElement | null;
}

interface UseFocusRestoreReturn {
  capture: () => HTMLElement | null;
  restore: () => boolean;
  target: HTMLElement | null;
}

function useFocusRestore(options?: UseFocusRestoreOptions): UseFocusRestoreReturn;
```

### Example

```tsx
function Panel({ open, close }: { open: boolean; close: () => void }) {
  const focusRestore = useFocusRestore();

  function openPanel() {
    focusRestore.capture();
    // then move focus into the panel
  }

  function closePanel() {
    close();
    focusRestore.restore();
  }

  return open ? <button onClick={closePanel}>Close</button> : <button onClick={openPanel}>Open</button>;
}
```

### Behavior

- `useFocusRestore()` keeps a module-level stack so nested overlays restore focus in close order.
- `capture()` should run before focus moves into temporary UI. `restore()` should run when that UI closes.
- `restoreOnUnmount` defaults to `true`; set it to `false` when the owner handles restore explicitly.

---

## Focus Restore Utilities

Plain DOM helpers used by `useFocusRestore`.

```ts
import {
  getRestorableFocusTarget,
  restoreFocus,
} from "@diffgazer/keys";
```

### Signatures

```ts
function getRestorableFocusTarget(ownerDocument?: Document): HTMLElement | null;

function restoreFocus(
  target: HTMLElement | null,
  options?: RestoreFocusOptions,
): boolean;
```

### Behavior

- `getRestorableFocusTarget()` returns the active HTMLElement unless focus is on `body`, `documentElement`, disconnected content, or no DOM is available.
- `restoreFocus()` focuses a connected target and returns whether focus actually moved there.

---

## keys

Utility to create a `Record<string, KeyHandler>` from an array of hotkeys and a single handler. Useful with the key-map overload of `useKey`.

```ts
import { keys } from "@diffgazer/keys";
```

### Signature

```ts
function keys(
  hotkeys: readonly string[],
  handler: (event: KeyboardEvent) => void,
): Record<string, (event: KeyboardEvent) => void>;
```

### Example

```tsx
// Instead of writing each arrow key separately:
useKey(keys(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"], handleArrow));

// Combine with other key maps:
useKey({
  ...keys(["ArrowUp", "ArrowDown"], navigate),
  Enter: select,
  Escape: cancel,
});
```

---

## useKeyboardContext and useOptionalKeyboardContext

Low-level hooks to access the `KeyboardProvider` context. `useKeyboardContext` throws when no provider is present. `useOptionalKeyboardContext` returns `null`.

```ts
import { useKeyboardContext, useOptionalKeyboardContext } from "@diffgazer/keys";
```

### Signature

```ts
function useKeyboardContext(): KeyboardContextValue;
function useOptionalKeyboardContext(): KeyboardContextValue | null;
```

### KeyboardContextValue

```ts
interface KeyboardContextValue {
  activeScope: string | null;
  getActiveScope: () => string | null;
  pushScope: (scope: string) => () => void;
  register: (scope: string, hotkey: string, handler: Handler, options?: HandlerOptions) => () => void;
}
```

### Behavior

- `useKeyboardContext` returns the active keyboard context and throws if `KeyboardProvider` is missing.
- `useOptionalKeyboardContext` returns the active keyboard context or `null` if `KeyboardProvider` is missing.
- This is what `useKey` uses internally. You probably don't need this directly unless you're building a custom hook on top of @diffgazer/keys.

---

## Types

### HandlerOptions

Passed to `register()` in the keyboard context. You won't use this directly -- it's the internal representation of `UseKeyOptions` fields.

```ts
interface HandlerOptions {
  allowInInput?: boolean;
  containerRef?: RefObject<HTMLElement | null>;
  focusWithinOnly?: boolean;
  preventDefault?: boolean;
}
```

### UseKeyOptions

Options for `useKey`. See [useKey](#usekey).

### UseFocusTrapOptions

Options for `useFocusTrap`. See [useFocusTrap](#usefocustrap).

### NavigationRole

```ts
type NavigationRole = "radio" | "checkbox" | "option" | "menuitem" | "menuitemcheckbox" | "menuitemradio" | "button" | "tab";
```
